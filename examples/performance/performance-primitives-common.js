const { hrtime } = require('process');

async function runConsumer(consumer, topic, warmupMessages, totalMessageCnt, eachBatch, partitionsConsumedConcurrently, stats) {
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

    console.log("Starting consumer.");
    let consumeMethod = {
        partitionsConsumedConcurrently,
        eachMessage: async ({ topic, partition, message }) => {
            messagesReceived++;

            if (messagesReceived >= skippedMessages) {
                messagesMeasured++;
                totalMessageSize += message.value.length;

                if (messagesReceived === skippedMessages) {
                    startTime = hrtime.bigint();
                } else if (messagesMeasured === totalMessageCnt) {
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
                    for (const message of messages)
                        totalMessageSize += message.value.length;

                    if (!startTime) {
                        startTime = hrtime.bigint();
                    } else if (messagesMeasured >= totalMessageCnt) {
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
            if (messagesMeasured >= totalMessageCnt) {
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
    return rate;
}

module.exports = {
    runConsumer
};