const { Kafka, CompressionTypes } = require('kafkajs');
const { randomBytes } = require('crypto');
const { hrtime } = require('process');
const { runConsumer: runConsumerCommon } = require('./performance-primitives-common');

module.exports = {
    runProducer,
    runConsumer,
    runConsumeTransformProduce,
    runCreateTopics,
    runProducerConsumerTogether,
};

function baseConfiguration(parameters) {
    let ret = {
        clientId: 'kafka-test-performance',
        brokers: parameters.brokers.split(','),
    };
    if (parameters.securityProtocol &&
        parameters.saslUsername &&
        parameters.saslPassword) {
        ret = {
            ...ret,
            ssl: parameters.securityProtocol.toLowerCase().includes('ssl'),
            sasl: {
                mechanism: 'plain',
                username: parameters.saslUsername,
                password: parameters.saslPassword
            }
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
    }

    await admin.disconnect();
}

async function runProducer(parameters, topic, batchSize, warmupMessages, totalMessageCnt, msgSize, compression, randomness) {
    let totalMessagesSent = 0;
    let totalBytesSent = 0;

    const messages = Array(batchSize);
    let staticValue = randomBytes(Math.floor(msgSize * (1 - randomness)));
    for (let i = 0; i < batchSize; i++) {
        /* Generate a different random value for each message */
        messages[i] = {
            value: Buffer.concat([staticValue, randomBytes(msgSize - staticValue.length)]),
        };
    }

    const kafka = new Kafka(baseConfiguration(parameters));

    const producer = kafka.producer();
    await producer.connect();

    console.log('Sending ' + warmupMessages + ' warmup messages.');
    while (warmupMessages > 0) {
        await producer.send({
            topic,
            messages,
            compression: CompressionTypes[compression],
        });
        warmupMessages -= batchSize;
    }
    console.log('Sent warmup messages');

    // Now that warmup is done, start measuring...
    let startTime;
    let promises = [];
    startTime = hrtime();
    let messagesDispatched = 0;

    // The double while-loop allows us to send a bunch of messages and then
    // await them all at once. We need the second while loop to keep sending
    // in case of queue full errors, which surface only on awaiting.
    while (totalMessageCnt == -1 || messagesDispatched < totalMessageCnt) {
        let messagesNotAwaited = 0;
        while (totalMessageCnt == -1 || messagesDispatched < totalMessageCnt) {
            promises.push(producer.send({
                topic,
                messages,
                compression: CompressionTypes[compression],
            }).then(() => {
                totalMessagesSent += batchSize;
                totalBytesSent += batchSize * msgSize;
            }).catch((err) => {
                console.error(err);
                throw err;
            }));
            messagesDispatched += batchSize;
            messagesNotAwaited += batchSize;
            if (messagesNotAwaited >= 10000)
                break;
        }
        await Promise.all(promises);
        promises = [];
    }
    let elapsed = hrtime(startTime);
    let durationNanos = elapsed[0] * 1e9 + elapsed[1];
    let rate = (totalBytesSent / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
    console.log(`Sent ${totalMessagesSent} messages, ${totalBytesSent} bytes; rate is ${rate} MB/s`);

    await producer.disconnect();
    return rate;
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
        return this.consumer.subscribe({
            ...opts,
            fromBeginning: true
        });
    }

    pause(topics) {
        return this.consumer.pause(topics);
    }

    run(opts) {
        return this.consumer.run({
            ...opts,
            autoCommit: false,
        });
    }
}

function newCompatibleConsumer(parameters) {
    const kafka = new Kafka(baseConfiguration(parameters));

    const consumer = kafka.consumer({
        groupId: 'test-group' + Math.random(),
    });
    return new CompatibleConsumer(consumer);
}

async function runConsumer(parameters, topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats) {
    return runConsumerCommon(newCompatibleConsumer(parameters), topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats);
}

async function runConsumeTransformProduce(parameters, consumeTopic, produceTopic, warmupMessages, totalMessageCnt, messageProcessTimeMs, ctpConcurrency) {
    const kafka = new Kafka(baseConfiguration(parameters));

    const producer = kafka.producer({});
    await producer.connect();

    const consumer = kafka.consumer({
        groupId: 'test-group' + Math.random(),
    });
    await consumer.connect();
    await consumer.subscribe({ topic: consumeTopic, fromBeginning: true });

    let messagesReceived = 0;
    let messagesMeasured = 0;
    let totalMessageSize = 0;
    let startTime;
    let rate;
    const skippedMessages = warmupMessages;

    console.log("Starting consume-transform-produce.");

    consumer.run({
        autoCommit: false,
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
                    let durationSeconds = durationNanos / 1e9;
                    rate = (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
                    console.log(`Recvd, transformed and sent ${messagesMeasured} messages in ${durationSeconds}, ${totalMessageSize} bytes; rate is ${rate} MB/s`);
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

    const producer = kafka.producer({});
    await producer.connect();

    let consumerReady = false;
    let consumerFinished = false;
    const consumer = kafka.consumer({
        groupId: 'test-group' + Math.random(),
    });
    await consumer.connect();
    await consumer.subscribe({ topic: topic, fromBeginning: true });

    let startTime = null;
    let diffs = [];
    console.log("Starting consumer.");

    consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
            if (!consumerReady) {
                consumerReady = true;
                return;
            }
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

    while(!consumerReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }


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
    // Count outliers: elements 10x or more than the p50.
    const outliers = sortedDiffs.map(d => d/1e6).filter(d => (d) > (10 * p50));
    return { mean, p50, p90, p95, outliers };
}
