const { Kafka, ErrorCodes, CompressionTypes } = require('../../').KafkaJS;
const { randomBytes } = require('crypto');
const { hrtime } = require('process');
const {
    runConsumer: runConsumerCommon,
    runProducer: runProducerCommon,
    genericProduceToTopic,
 } = require('./performance-primitives-common');

module.exports = {
    runProducer,
    runConsumer,
    runConsumeTransformProduce,
    runCreateTopics,
    runProducerConsumerTogether,
};

function baseConfiguration(parameters) {
    let ret = {
        'client.id': 'kafka-test-performance',
        'metadata.broker.list': parameters.brokers,
    };
    if (parameters.securityProtocol &&
        parameters.saslUsername &&
        parameters.saslPassword) {
        ret = {
            ...ret,
            'security.protocol': parameters.securityProtocol,
            'sasl.mechanism': 'PLAIN',
            'sasl.username': parameters.saslUsername,
            'sasl.password': parameters.saslPassword,
        };
    }
    return ret;
}

async function runCreateTopics(parameters, topic, topic2, numPartitions) {
    const kafka = new Kafka(baseConfiguration(parameters));

    const admin = kafka.admin();
    await admin.connect();

    for (let t of [topic, topic2]) {
        let topicCreated = await admin.createTopics({
            topics: [{ topic: t, numPartitions }],
        }).catch(console.error);
        if (topicCreated) {
            console.log(`Created topic ${t} with ${numPartitions} partitions`);
            continue;
        }

        console.log(`Topic ${t} already exists, deleting and recreating.`);
        await admin.deleteTopics({ topics: [t] }).catch(console.error);
        await new Promise(resolve => setTimeout(resolve, 1000)); /* Propagate. */
        await admin.createTopics({
            topics: [
                { topic: t, numPartitions },
            ],
        }).catch(console.error);
        console.log(`Created topic ${t} with ${numPartitions} partitions`);
        await new Promise(resolve => setTimeout(resolve, 1000)); /* Propagate. */
    }

    await admin.disconnect();
}

class CompatibleProducer {
    constructor(producer) {
        this.producer = producer;
    }

    async connect() {
        return this.producer.connect();
    }

    async disconnect() {
        return this.producer.disconnect();
    }

    isQueueFullError(err) {
        return err.code === ErrorCodes.ERR__QUEUE_FULL;
    }

    send(opts) {
        return this.producer.send(opts);
    }
}
function newCompatibleProducer(parameters, compression) {
    return new CompatibleProducer(
        new Kafka({
        ...baseConfiguration(parameters),
        'compression.codec': CompressionTypes[compression],
    }).producer());
}

async function runProducer(parameters, topic, batchSize, warmupMessages, totalMessageCnt, msgSize, compression, randomness, limitRPS) {
    return runProducerCommon(newCompatibleProducer(parameters, compression), topic, batchSize, warmupMessages, totalMessageCnt, msgSize, compression, randomness, limitRPS);
}

class CompatibleConsumer {
    constructor(consumer) {
        this.consumer = consumer;
    }

    async connect() {
        return this.consumer.connect();
    }

    async disconnect() {
        return this.consumer.disconnect();
    }

    async subscribe(opts) {
        return this.consumer.subscribe(opts);
    }

    pause(topics) {
        return this.consumer.pause(topics);
    }

    run(opts) {
        return this.consumer.run({
            ...opts
        });
    }
}

function newCompatibleConsumer(parameters) {
    const kafka = new Kafka(baseConfiguration(parameters));

    const consumer = kafka.consumer({
        'group.id': 'test-group' + Math.random(),
        'enable.auto.commit': false,
        'auto.offset.reset': 'earliest',
        'fetch.queue.backoff.ms': '100',
    });
    return new CompatibleConsumer(consumer);
}


async function runConsumer(parameters, topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats, produceToTopic, produceCompression) {
    let actionOnMessages = null;
    if (produceToTopic) {
        const producer = newCompatibleProducer(parameters, produceCompression);
        await producer.connect();
        actionOnMessages = (messages) =>
            genericProduceToTopic(producer, produceToTopic, messages);
    }
    const ret = await runConsumerCommon(newCompatibleConsumer(parameters), topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats, actionOnMessages);
    if (produceToTopic) {
        await producer.disconnect();
    }
    return ret;
}

async function runConsumeTransformProduce(parameters, consumeTopic, produceTopic, warmupMessages, totalMessageCnt, messageProcessTimeMs, ctpConcurrency) {
    const kafka = new Kafka(baseConfiguration(parameters));

    const producer = kafka.producer({
        /* We want things to be flushed immediately as we'll be awaiting this. */
        'linger.ms': 0
    });
    await producer.connect();

    const consumer = kafka.consumer({
        'group.id': 'test-group' + Math.random(),
        'enable.auto.commit': false,
        'auto.offset.reset': 'earliest',

        /* These fields are more-or-less required for cases where eachMessage includes
         * any async operatiosn, else `partitionsConsumedConcurrently` does not have
         * much effect. Reason for this is that, internally, librdkafka fetches
         * a large number of messages from one topic partition and that fills the
         * cache up, and we end up underutilizing concurrency.
         * TODO: remove or change these, discuss this issue and make changes in the code. */
        'message.max.bytes': 1000,
        'fetch.max.bytes': 1000,
    });
    await consumer.connect();
    await consumer.subscribe({ topic: consumeTopic });

    let messagesReceived = 0;
    let messagesMeasured = 0;
    let totalMessageSize = 0;
    let startTime;
    let rate;
    const skippedMessages = warmupMessages;

    console.log("Starting consume-transform-produce.");

    consumer.run({
        partitionsConsumedConcurrently: ctpConcurrency,
        eachMessage: async ({ topic, partition, message }) => {
            messagesReceived++;

            if (messagesReceived >= skippedMessages) {
                messagesMeasured++;
                totalMessageSize += message.value.length;

                if (messagesReceived === skippedMessages)
                    startTime = hrtime();

                /* Simulate message processing for messageProcessTimeMs */
                if (messageProcessTimeMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, messageProcessTimeMs));
                }
                await producer.send({
                    topic: produceTopic,
                    messages: [{ value: message.value }],
                })

                if (messagesMeasured === totalMessageCnt) {
                    let elapsed = hrtime(startTime);
                    let durationNanos = elapsed[0] * 1e9 + elapsed[1];
                    rate = (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
                    console.log(`Recvd, transformed and sent ${messagesMeasured} messages, ${totalMessageSize} bytes; rate is ${rate} MB/s`);
                    consumer.pause([{ topic }]);
                }
            } else {
                await producer.send({
                    topic: produceTopic,
                    messages: [{ value: message.value }],
                })
            }
        }
    });

    totalMessageSize = 0;
    await new Promise((resolve) => {
        let interval = setInterval(() => {
            if (messagesMeasured >= totalMessageCnt) {
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    });

    await consumer.disconnect();
    await producer.disconnect();
    return rate;
}

async function runProducerConsumerTogether(parameters, topic, totalMessageCnt, msgSize, produceMessageProcessTimeMs, consumeMessageProcessTimeMs) {
    const kafka = new Kafka(baseConfiguration(parameters));

    const producer = kafka.producer({
        /* We want things to be flushed immediately as we'll be awaiting this. */
        'linger.ms': 0,
    });
    await producer.connect();

    let consumerReady = false;
    let consumerFinished = false;
    const consumer = kafka.consumer({
        'group.id': 'test-group' + Math.random(),
        'enable.auto.commit': false,
        'auto.offset.reset': 'earliest',
        rebalance_cb: function(err) {
            if (err.code !== ErrorCodes.ERR__ASSIGN_PARTITIONS) return;
            if (!consumerReady) {
                consumerReady = true;
                console.log("Consumer ready.");
            }
        }
    });
    await consumer.connect();
    await consumer.subscribe({ topic: topic });

    let startTime = null;
    let diffs = [];
    console.log("Starting consumer.");

    consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            if (startTime === null)
                return;
            let endTime = hrtime.bigint();
            diffs.push(endTime - startTime);
            await new Promise(resolve => setTimeout(resolve, consumeMessageProcessTimeMs));
            if (diffs.length >= totalMessageCnt) {
                consumerFinished = true;
            }
        }
    });

    while(!consumerReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const message = {
        value: randomBytes(msgSize),
    }

    // Don't initialize startTime here, the first message includes the metadata
    // request and isn't representative of latency measurements.
    await producer.send({
        topic,
        messages: [message],
    });
    // We don't want this to show up at all for our measurements, so make sure the
    // consumer processes this and ignores it before proceeding.
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("Starting producer.");

    for (let i = 0; i < totalMessageCnt; i++) {
        startTime = hrtime.bigint();
        await producer.send({
            topic,
            messages: [message],
        });
        await new Promise(resolve => setTimeout(resolve, produceMessageProcessTimeMs));
    }

    while (!consumerFinished) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("Consumer finished.");

    await consumer.disconnect();
    await producer.disconnect();

    const nanoDiffs = diffs.map(d => parseInt(d));
    const sortedDiffs = nanoDiffs.sort((a, b) => a - b);
    const p50 = sortedDiffs[Math.floor(sortedDiffs.length / 2)] / 1e6;
    const p90 = sortedDiffs[Math.floor(sortedDiffs.length * 0.9)] / 1e6;
    const p95 = sortedDiffs[Math.floor(sortedDiffs.length * 0.95)] / 1e6;
    const mean = nanoDiffs.reduce((acc, d) => acc + d, 0) / nanoDiffs.length / 1e6;
    // Count outliers: elements 10x or more than the p50. My choice of what an
    // outlier is defined as, is arbitrary.
    const outliers = sortedDiffs.map(d => d/1e6).filter(d => (d) > (10 * p50));
    return { mean, p50, p90, p95, outliers };
}
