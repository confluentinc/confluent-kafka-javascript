const { hrtime } = require('process');

async function runConsumer(consumer, topic, warmupMessages, totalMessageCnt, eachBatch, stats) {
    await consumer.connect();
    await consumer.subscribe({ topic });

    let messagesReceived = 0;
    let messagesMeasured = 0;
    let totalMessageSize = 0;
    let totalBatches = 0n;
    let totalOffsetLag = 0n;
    let maxOffsetLag = 0n;
    let durationSeconds = 0n;
    let startTime;
    let rate;
    const skippedMessages = warmupMessages;

    console.log("Starting consumer.");
    let consumeMethod = {
        eachMessage: async ({ topic, partition, message }) => {
            messagesReceived++;

            if (messagesReceived >= skippedMessages) {
                messagesMeasured++;
                totalMessageSize += message.value.length;

                if (messagesReceived === skippedMessages) {
                    startTime = hrtime();
                } else if (messagesMeasured === totalMessageCnt) {
                    let elapsed = hrtime(startTime);
                    let durationNanos = elapsed[0] * 1e9 + elapsed[1];
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
            eachBatch: async ({ batch }) => {
                const messagesBeforeBatch = messagesReceived;
                const topic = batch.topic;
                messagesReceived += batch.messages.length;
                if (messagesReceived >= skippedMessages) {
                    const offsetLag = BigInt(batch.offsetLag());
                    totalOffsetLag += offsetLag;
                    maxOffsetLag = offsetLag > maxOffsetLag ? offsetLag : maxOffsetLag;
                    totalBatches++;
                    messagesMeasured = messagesReceived - skippedMessages;
                    let messages = batch.messages;
                    if (messagesBeforeBatch < skippedMessages) {
                        messages = messages.slice(messages.length - messagesMeasured);
                    }
                    for (const message of messages)
                        totalMessageSize += message.value.length;

                    if (!startTime) {
                        startTime = hrtime();
                    } else if (messagesMeasured === totalMessageCnt) {
                        let elapsed = hrtime(startTime);
                        let durationNanos = elapsed[0] * 1e9 + elapsed[1];
                        durationSeconds = durationNanos / 1e9;
                        rate = (totalMessageSize / durationNanos) * 1e9 / (1024 * 1024); /* MB/s */
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
            stats.averageOffsetLag = totalBatches > 0n ? (totalOffsetLag / totalBatches) : 0n;
            stats.maxOffsetLag = maxOffsetLag;
        }
        stats.durationSeconds = durationSeconds;
    }
    return rate;
}

module.exports = {
    runConsumer
};