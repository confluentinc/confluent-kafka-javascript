const { hrtime } = require('process');
const { randomBytes } = require('crypto');

const TERMINATE_TIMEOUT_MS = process.env.TERMINATE_TIMEOUT_MS ? +process.env.TERMINATE_TIMEOUT_MS : 600000;
const AUTO_COMMIT = process.env.AUTO_COMMIT || 'false';
let autoCommit;
if (AUTO_COMMIT && AUTO_COMMIT === 'false')
    autoCommit = null;
else {
    autoCommit = Number(AUTO_COMMIT);
    if (isNaN(autoCommit)) {
        autoCommit = null;
    }
}

function installHandlers() {
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
    handlers.terminateTimeout = setTimeout(terminationRequestedCallback,
                                  TERMINATE_TIMEOUT_MS);
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
    const handlers = installHandlers();
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
    const skippedMessages = warmupMessages;
    const decoder = new TextDecoder('utf-8');

    const updateLatency = (receivedAt, numMessages, message) => {
        if (!stats)
            return;

        const sentAt = Number(decoder.decode(message.value.slice(0, 13)));
        const latency = receivedAt - sentAt;

        if (!stats.maxLatency) {
            stats.maxLatency = latency;
            stats.avgLatency = latency;
        } else {
            stats.maxLatency = Math.max(stats.maxLatency, latency);
            stats.avgLatency = ((stats.avgLatency * (numMessages - 1)) + latency) / numMessages;
        }
    };

    const shouldTerminate = () => {
        return handlers.terminationRequested ||
        (totalMessageCnt > 0 && messagesMeasured >= totalMessageCnt);
    };

    console.log("Starting consumer.");
    let consumeMethod = {
        partitionsConsumedConcurrently,
        eachMessage: async ({ topic, partition, message }) => {
            messagesReceived++;
            if (actionOnMessages) {
                await actionOnMessages([message]);
            }

            if (messagesReceived >= skippedMessages) {
                messagesMeasured++;
                totalMessageSize += message.value.length;
                updateLatency(Date.now(), messagesMeasured, message);

                if (messagesReceived === skippedMessages) {
                    startTime = hrtime.bigint();
                } else if (totalMessageCnt > 0 && messagesMeasured === totalMessageCnt) {
                    let durationNanos = Number(hrtime.bigint() - startTime);
                    durationSeconds = durationNanos / 1e9;
                    rate = (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
                    console.log(`Recvd ${messagesMeasured} messages in ${durationSeconds} seconds, ${totalMessageSize} bytes; rate is ${rate} MB/s`);
                    consumer.pause([{ topic }]);
                }
            }
        }
    }
    if (eachBatch) {
        consumeMethod = {
            partitionsConsumedConcurrently,
            eachBatch: async ({ batch }) => {
                const messagesBeforeBatch = messagesReceived;
                const topic = batch.topic;
                if (actionOnMessages) {
                    await actionOnMessages(batch.messages);
                }

                messagesReceived += batch.messages.length;
                if (messagesReceived >= skippedMessages) {
                    const offsetLag = batch.offsetLag();
                    totalOffsetLag += Number(offsetLag);
                    maxOffsetLag = Math.max(offsetLag, maxOffsetLag);
                    totalBatches++;
                    messagesMeasured = messagesReceived - skippedMessages;
                    let messages = batch.messages;
                    if (messagesBeforeBatch < skippedMessages) {
                        messages = messages.slice(messages.length - messagesMeasured);
                    }
                    const now = Date.now();
                    const messagesBase = messagesMeasured - messages.length;
                    let i = 1;
                    for (const message of messages) {
                        totalMessageSize += message.value.length;
                        updateLatency(now, messagesBase + i, message);
                        i++;
                    }

                    if (!startTime) {
                        startTime = hrtime.bigint();
                    } else if (totalMessageCnt > 0 && messagesMeasured >= totalMessageCnt) {
                        let durationNanos = Number(hrtime.bigint() - startTime);
                        durationSeconds = durationNanos / 1e9;
                        rate = durationNanos === 0 ? Infinity :
                            (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
                        console.log(`Recvd ${messagesMeasured} messages in ${durationSeconds} seconds, ${totalMessageSize} bytes; rate is ${rate} MB/s`);
                        consumer.pause([{ topic }]);
                    }
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
    const handlers = installHandlers();
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

module.exports = {
    runConsumer,
    runProducer,
    genericProduceToTopic,
    getAutoCommit,
};