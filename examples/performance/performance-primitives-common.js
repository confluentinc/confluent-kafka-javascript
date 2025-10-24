const { hrtime } = require('process');
const { randomBytes } = require('crypto');
const PERCENTILES = [50, 75, 90, 95, 99, 99.9, 99.99, 100];

const TERMINATE_TIMEOUT_MS = process.env.TERMINATE_TIMEOUT_MS ? +process.env.TERMINATE_TIMEOUT_MS : 600000;
const AUTO_COMMIT = process.env.AUTO_COMMIT || 'false';
const AUTO_COMMIT_ON_BATCH_END = process.env.AUTO_COMMIT_ON_BATCH_END === 'true';
let autoCommit;
if (AUTO_COMMIT && AUTO_COMMIT === 'false')
    autoCommit = null;
else {
    autoCommit = Number(AUTO_COMMIT);
    if (isNaN(autoCommit)) {
        autoCommit = null;
    }
}

function installHandlers(useTerminateTimeout) {
    const handlers = {
        terminationRequested: false,
        terminateTimeout: null,
    };
    const terminationRequestedCallback = () => {
        console.log('Termination requested, waiting for current operation to finish...');
        handlers.terminationRequested = true;
    }
    process.on('SIGINT', terminationRequestedCallback);
    process.on('SIGTERM', terminationRequestedCallback);
    handlers.terminationRequestedCallback = terminationRequestedCallback;
    if (useTerminateTimeout) {
        handlers.terminateTimeout = setTimeout(terminationRequestedCallback,
            TERMINATE_TIMEOUT_MS);
    }
    return handlers;
}

function removeHandlers(handlers) {
    process.off('SIGINT', handlers.terminationRequestedCallback);
    process.off('SIGTERM', handlers.terminationRequestedCallback);
    clearTimeout(handlers.terminateTimeout);
}

function getAutoCommit() {
    return autoCommit;
}

function genericProduceToTopic(producer, topic, messages) {
    return producer.send({
        topic,
        messages,
    }).catch((err) => {
        if (producer.isQueueFullError(err)) {
            /* do just send them again */
            return genericProduceToTopic(producer, topic, messages);
        } else {
            console.error(err);
            throw err;
        }
    });
}


// We use a simple count-sketch for latency percentiles to avoid storing all latencies in memory.
// because we're also measuring the memory usage of the consumer as part of the performance tests.
class LatencyCountSketch {
    #numBuckets;
    #minValue;
    #maxValue;
    #buckets;
    #counts;
    #changeBaseLogarithm;
    #totalCount = 0;
    #base;

    constructor({
        error = 0.01, // 1% error
        minValue = 0.01, // min 10μs latency
        maxValue = 60000, // max 60s latency
    }) {
        // Each bucket represents [x, x * (1 + error))
        this.#base = 1 + error;
        // Change base from natural log to log base this.#base
        this.#changeBaseLogarithm =  Math.log(this.#base);
        this.#numBuckets = Math.ceil(Math.log(maxValue / minValue) / Math.log(this.#base));
        this.#maxValue = maxValue;

        this.#buckets = new Array(this.#numBuckets + 2).fill(0);
        this.#buckets[this.#numBuckets + 1] = Number.POSITIVE_INFINITY;
        this.#buckets[this.#numBuckets] = this.#maxValue;
        this.#buckets[0] = 0;
        let i = this.#numBuckets - 1;
        let currentValue = maxValue;
        while (i >= 1) {
            let nextMinimum = currentValue / this.#base;
            this.#buckets[i] = nextMinimum;
            currentValue = nextMinimum;
            i--;
        }
        this.#minValue = this.#buckets[1];
        this.#counts = new Array(this.#numBuckets + 2).fill(0);
    }

    add(latency) {
        let idx = 0;
        if (latency > 0)
            idx = Math.ceil(Math.log(latency / this.#minValue) / this.#changeBaseLogarithm);
        idx = (idx < 0) ? 0 :
              (idx > this.#buckets.length - 2) ? (this.#buckets.length - 2) :
               idx;
        
        this.#counts[idx]++;
        this.#totalCount++;
    }

    percentiles(percentilesArray) {
        const percentileCounts = percentilesArray.map(p => Math.ceil(this.#totalCount * p / 100));
        const percentileResults = new Array(percentilesArray.length);
        var totalCountSoFar = 0;
        let j = 0;
        let sum = 0;
        for (let i = 0; i < this.#counts.length; i++) {
            sum += this.#counts[i];
        }
        for (let i = 0; i < percentileCounts.length; i++) {
            while ((totalCountSoFar < percentileCounts[i]) && (j < this.#counts.length - 1)) {
                totalCountSoFar += this.#counts[j];
                j++;
            }
            const bucketIndex = (j < this.#counts.length - 1) ? j : this.#counts.length - 2;
            percentileResults[i] = [this.#buckets[bucketIndex], totalCountSoFar, this.#totalCount];
        }
        return percentileResults;
    }
}

async function runConsumer(consumer, topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats, actionOnMessages) {
    const handlers = installHandlers(totalMessageCnt === -1);
    if (stats) {
        stats.percentilesTOT1 = new LatencyCountSketch({});
        stats.percentilesTOT2 = new LatencyCountSketch({});
    }
    while (true) {
        try {
            await consumer.connect();
            break;
        } catch (e) {
            console.error(`Error connecting consumer: ${e}`);
        }
    }
    while (true) {
        try {
            await consumer.subscribe({ topic });
            break;
        } catch (e) {
            console.error(`Error subscribing consumer: ${e}`);
        }
    }

    let messagesReceived = 0;
    let messagesMeasured = 0;
    let totalMessageSize = 0;
    let totalBatches = 0;
    let totalOffsetLag = 0;
    let maxOffsetLag = 0;
    let durationSeconds = 0;
    let startTime;
    let rate;
    let consumptionStopped = false;
    let lastMessageReceivedAt;
    const skippedMessages = warmupMessages;
    const decoder = new TextDecoder('utf-8');

    const updateLatency = (receivedAt, numMessages, message, isT0T2) => {
        if (!stats)
            return;

        const sentAt = Number(decoder.decode(message.value.slice(0, 13)));
        let latency = receivedAt - sentAt;

        if (isNaN(latency)) {
            console.log(`WARN: NaN latency received message timestamp: ${message.value.slice(0, 13)}`);
            return;
        } else if (latency < 0) {
            console.log(`WARN: negative latency ${latency} sentAt ${sentAt} receivedAt ${receivedAt}`);
            latency = 0;
        } else if (latency > 60000) {
            console.log(`WARN: received large latency ${latency} sentAt ${sentAt} receivedAt ${receivedAt}`);
        }

        if (!isT0T2) {
            if (!stats.maxLatencyT0T1) {
                stats.maxLatencyT0T1 = latency;
                stats.avgLatencyT0T1 = latency;
            } else {
                stats.maxLatencyT0T1 = Math.max(stats.maxLatencyT0T1, latency);
                stats.avgLatencyT0T1 = ((stats.avgLatencyT0T1 * (numMessages - 1)) + latency) / numMessages;
            }
            stats.percentilesTOT1.add(latency);
        } else {
            if (!stats.maxLatencyT0T2) {
                stats.maxLatencyT0T2 = latency;
                stats.avgLatencyT0T2 = latency;
            } else {
                stats.maxLatencyT0T2 = Math.max(stats.maxLatencyT0T2, latency);
                stats.avgLatencyT0T2 = ((stats.avgLatencyT0T2 * (numMessages - 1)) + latency) / numMessages;
            }
            stats.percentilesTOT2.add(latency);
        }
    };

    const shouldTerminate = () => {
        return handlers.terminationRequested ||
        (totalMessageCnt > 0 && messagesMeasured >= totalMessageCnt);
    };

    const stopConsuming = () => {
        if (consumptionStopped)
            return;
        consumptionStopped = true;
        const now = lastMessageReceivedAt || hrtime.bigint();
        let durationNanos = Number(now - startTime);
        durationSeconds = durationNanos / 1e9;
        rate = (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
        console.log(`Recvd ${messagesMeasured} messages in ${durationSeconds} seconds, ${totalMessageSize} bytes; rate is ${rate} MB/s`);
        try {
            consumer.pause([{ topic }]);
        } catch (e) {
            console.error(`Error pausing consumer: ${e}`);
        }
    }

    console.log("Starting consumer.");
    let consumeMethod = {
        partitionsConsumedConcurrently,
        eachMessage: async ({ topic, partition, message }) => {
            messagesReceived++;
            if (messagesReceived >= skippedMessages) {
                messagesMeasured++;
                totalMessageSize += message.value.length;
                updateLatency(Date.now(), messagesMeasured, message, false);

                if (messagesReceived === skippedMessages) {
                    startTime = hrtime.bigint();
                } else if (totalMessageCnt > 0 && messagesMeasured === totalMessageCnt) {
                    stopConsuming();
                }
            }

            if (actionOnMessages) {
                await actionOnMessages([message]);
                updateLatency(Date.now(), messagesMeasured, message, true);
            }

            if (autoCommit !== null && AUTO_COMMIT_ON_BATCH_END) {
                await consumer.commitOffsetsOnBatchEnd([{
                    topic,
                    partition,
                    offset: (Number(message.offset) + 1).toString(),
                }]);
            }
        }
    }
    if (eachBatch) {
        consumeMethod = {
            partitionsConsumedConcurrently,
            eachBatch: async ({ batch }) => {
                if (!batch.messages)
                    return;
                const messagesBeforeBatch = messagesReceived;
                const topic = batch.topic;
                const partition = batch.partition;
                let messagesBase;
                let messages;
                messagesReceived += batch.messages.length;
                if (messagesReceived >= skippedMessages) {
                    const offsetLag = batch.offsetLag();
                    totalOffsetLag += Number(offsetLag);
                    maxOffsetLag = Math.max(offsetLag, maxOffsetLag);
                    totalBatches++;
                    messagesMeasured = messagesReceived - skippedMessages;
                    messages = batch.messages;
                    if (messagesBeforeBatch < skippedMessages) {
                        messages = messages.slice(messages.length - messagesMeasured);
                    }
                    const now = Date.now();
                    lastMessageReceivedAt = hrtime.bigint();
                    messagesBase = messagesMeasured - messages.length;
                    let i = 1;
                    for (const message of messages) {
                        totalMessageSize += message.value.length;
                        updateLatency(now, messagesBase + i, message, false);
                        i++;
                    }

                    if (!startTime) {
                        startTime = hrtime.bigint();
                    } else if (totalMessageCnt > 0 && messagesMeasured >= totalMessageCnt) {
                        stopConsuming();
                    }
                }

                if (actionOnMessages) {
                    await actionOnMessages(batch.messages);
                    if (messagesMeasured > 0 && messages && messages.length > 0) {
                        let i = 1;
                        const now = Date.now();
                        for (const message of messages) {
                            totalMessageSize += message.value.length;
                            updateLatency(now, messagesBase + i, message, true);
                            i++;
                        }
                    }
                }

                if (autoCommit !== null && AUTO_COMMIT_ON_BATCH_END) {
                    await consumer.commitOffsetsOnBatchEnd([{
                        topic,
                        partition,
                        offset: (Number(batch.lastOffset()) + 1).toString(),
                    }]);
                }
            }
        };
    }

    consumer.run({
        ...consumeMethod
    });

    await new Promise((resolve) => {
        let interval = setInterval(() => {
            if (shouldTerminate()) {
                stopConsuming();
                clearInterval(interval);
                resolve();
            }
        }, 1000);
    });

    await consumer.disconnect();

    if (stats) {
        if (eachBatch) {
            stats.averageOffsetLag = totalBatches > 0 ? (totalOffsetLag / totalBatches) : 0;
            stats.maxOffsetLag = maxOffsetLag;
            stats.averageBatchSize = totalBatches > 0 ? (messagesMeasured / totalBatches) : 0;
        }
        stats.messageRate = durationSeconds > 0 ? 
                            (messagesMeasured / durationSeconds) : Infinity;
        stats.durationSeconds = durationSeconds;
        stats.percentilesTOT1 = stats.percentilesTOT1.percentiles(PERCENTILES).map((value, index) => ({
            percentile: PERCENTILES[index],
            value: value[0],
            count: value[1],
            total: value[2],
        }));
        stats.percentilesTOT2 = stats.percentilesTOT2.percentiles(PERCENTILES).map((value, index) => ({
            percentile: PERCENTILES[index],
            value: value[0],
            count: value[1],
            total: value[2],
        }));
    }
    removeHandlers(handlers);
    return rate;
}

async function runProducer(producer, topic, batchSize, warmupMessages, totalMessageCnt, msgSize, compression, randomness, limitRPS) {
    const handlers = installHandlers(totalMessageCnt === -1);
    let totalMessagesSent = 0;
    let totalBytesSent = 0;

    const encoder = new TextEncoder();
    let staticValueLength = Math.floor(msgSize * (1 - randomness));
    if (staticValueLength < 13)
        staticValueLength = 13;
    let staticValueRemainder = staticValueLength - 13;
    if (staticValueRemainder > 0) {
        staticValueRemainder = randomBytes(staticValueRemainder);
    } else {
        staticValueRemainder = Buffer.alloc(0);
    }

    let messageCnt = totalMessageCnt;
    if (messageCnt === -1) {
        messageCnt = batchSize * 10000;
    }
    const messages = Array(messageCnt);
    for (let i = 0; i < messageCnt; i++) {
        /* Generate a different random value for each message */
        messages[i] = {
            value: Buffer.concat([staticValueRemainder, randomBytes(msgSize - staticValueLength)]),
        };
    }

    await producer.connect();

    console.log('Sending ' + warmupMessages + ' warmup messages.');
    while (warmupMessages > 0) {
        await producer.send({
            topic,
            messages: messages.slice(0, batchSize)
        }, compression);
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
        const startTimeBatch = hrtime.bigint();
        const maxToAwait = limitRPS ? limitRPS : 10000;
        let messagesNotAwaited = 0;
        while (totalMessageCnt == -1 || messagesDispatched < totalMessageCnt) {
            const modifiedMessages = [];
            const batchStart = messagesDispatched % messageCnt;
            for (const msg of messages.slice(batchStart, batchStart + batchSize)) {
                modifiedMessages.push({ 
                    value: Buffer.concat([encoder.encode(Date.now().toString()), msg.value])
                });
            }
            promises.push(producer.send({
                topic,
                messages: modifiedMessages,
            }, compression).then(() => {
                totalMessagesSent += batchSize;
                totalBytesSent += batchSize * msgSize;
            }).catch((err) => {
                if (producer.isQueueFullError(err)) {
                    /* do nothing, just send them again */
                    messagesDispatched -= batchSize;
                    totalMessagesSent -= batchSize;
                    totalBytesSent -= batchSize * msgSize;
                } else {
                    console.error(err);
                    throw err;
                }
            }));
            messagesDispatched += batchSize;
            messagesNotAwaited += batchSize;
            if (handlers.terminationRequested || messagesNotAwaited >= maxToAwait)
                break;
        }
        await Promise.all(promises);
        promises = [];
        if (handlers.terminationRequested)
            break;

        const now = hrtime.bigint();
        const elapsedBatch = now - startTimeBatch;
        if (limitRPS && elapsedBatch < 1000000000n) {
            await new Promise(resolve => setTimeout(resolve, Number(1000000000n - elapsedBatch) / 1e6));
        }
    }
    let elapsed = hrtime(startTime);
    let durationNanos = elapsed[0] * 1e9 + elapsed[1];
    let rate = (totalBytesSent / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
    console.log(`Sent ${totalMessagesSent} messages, ${totalBytesSent} bytes; rate is ${rate} MB/s`);

    await producer.disconnect();
    removeHandlers(handlers);
    return rate;
}

async function runLagMonitoring(admin, topic) {
    const handlers = installHandlers(true);
    let groupId = process.env.GROUPID_MONITOR;
    if (!groupId) {
        throw new Error("GROUPID_MONITOR environment variable not set");
    }

    await admin.connect();

    const fetchTotalLag = async () => {
        const partitionCompleteLag = {};
        const partitionHWM = {};
        const partitionLag = {};
        let totalLag = 0n;
        const operations = [
            admin.fetchTopicOffsets(topic, { timeout: 30000 }),
            admin.fetchOffsets({ groupId, topics: [topic], timeout: 30000 }),
        ]
        let [topicOffsets, groupOffsets] = await Promise.all(operations);
        groupOffsets = groupOffsets[0];

        for (const partitionOffset of topicOffsets) {
            partitionHWM[partitionOffset.partition] = BigInt(partitionOffset.high);
            partitionCompleteLag[partitionOffset.partition] = BigInt(partitionOffset.high) - BigInt(partitionOffset.low);
        }
        
        if (groupOffsets && groupOffsets.partitions) {
            for (const partitionOffset of groupOffsets.partitions) {
                const partition = partitionOffset.partition;
                const hwm = partitionHWM[partition];
                if (hwm && partitionOffset.offset && hwm >= BigInt(partitionOffset.offset)) {
                    const currentLag = hwm - BigInt(partitionOffset.offset);
                    partitionLag[partition] = currentLag;
                    totalLag += currentLag;
                }
            }
        } else {
            throw new Error(`No offsets found for group ${groupId} on topic ${topic}`);
        }
        for (const partition of Object.keys(partitionHWM)) {
            if (partitionLag[partition] === undefined) {
                const currentLag = partitionCompleteLag[partition];
                partitionLag[partition] = currentLag;
                totalLag += currentLag;
            }
        }
        return totalLag;
    }

    let totalAverageLag = 0n;
    let maxLag = 0n;
    let totalMeasurements = 0;

    while (!handlers.terminationRequested) {
        try {
            const lag = await fetchTotalLag();
            totalAverageLag += lag;
            maxLag = lag > maxLag ? lag : maxLag;
            totalMeasurements++;
        } catch (e) {
            console.error(`Error fetching lag: ${e}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const averageLag = totalMeasurements > 0 ? (Number(totalAverageLag) / totalMeasurements) : NaN;
    maxLag = Number(maxLag);

    await admin.disconnect();
    removeHandlers(handlers);
    return {
        averageLag,
        maxLag,
        totalMeasurements
    };
}

module.exports = {
    runConsumer,
    runProducer,
    runLagMonitoring,
    genericProduceToTopic,
    getAutoCommit,
};