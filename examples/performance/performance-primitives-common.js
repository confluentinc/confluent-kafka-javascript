const { hrtime } = require('process');
const { randomBytes } = require('crypto');

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

async function runConsumer(consumer, topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats, actionOnMessages) {
    const handlers = installHandlers(totalMessageCnt === -1);
    await consumer.connect();
    await consumer.subscribe({ topic });

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
    const skippedMessages = warmupMessages;
    const decoder = new TextDecoder('utf-8');

    const updateLatency = (receivedAt, numMessages, message, isT0T2) => {
        if (!stats)
            return;

        const sentAt = Number(decoder.decode(message.value.slice(0, 13)));
        const latency = receivedAt - sentAt;

        if (!isT0T2) {
            if (!stats.maxLatencyT0T1) {
                stats.maxLatencyT0T1 = latency;
                stats.avgLatencyT0T1 = latency;
            } else {
                stats.maxLatencyT0T1 = Math.max(stats.maxLatencyT0T1, latency);
                stats.avgLatencyT0T1 = ((stats.avgLatencyT0T1 * (numMessages - 1)) + latency) / numMessages;
            }
        } else {
            if (!stats.maxLatencyT0T2) {
                stats.maxLatencyT0T2 = latency;
                stats.avgLatencyT0T2 = latency;
            } else {
                stats.maxLatencyT0T2 = Math.max(stats.maxLatencyT0T2, latency);
                stats.avgLatencyT0T2 = ((stats.avgLatencyT0T2 * (numMessages - 1)) + latency) / numMessages;
            }
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
        let durationNanos = Number(hrtime.bigint() - startTime);
        durationSeconds = durationNanos / 1e9;
        rate = (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
        console.log(`Recvd ${messagesMeasured} messages in ${durationSeconds} seconds, ${totalMessageSize} bytes; rate is ${rate} MB/s`);
        consumer.pause([{ topic }]);
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
                    if (messagesMeasured > 0 && messages.length > 0) {
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