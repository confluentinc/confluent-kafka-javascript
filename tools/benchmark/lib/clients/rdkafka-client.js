'use strict';

const path = require('path');
const crypto = require('crypto');

// Import the library
const Kafka = require(path.join(__dirname, '..', '..', '..', '..'));

/**
 * RdKafka client implementation using raw node-rdkafka API.
 * Adapted from bench/producer-rdkafka.js and bench/consumer-subscribe.js patterns.
 */
class RdKafkaClient {
    constructor(config) {
        this.config = config;
        this.name = 'rdkafka';
    }

    /**
     * Create topics for benchmarking.
     * @returns {Promise<void>}
     */
    async createTopics() {
        const admin = Kafka.AdminClient.create({
            'metadata.broker.list': this.config.brokers
        });

        const createTopic = (topic) => {
            return new Promise((resolve, reject) => {
                admin.createTopic({
                    topic: topic,
                    num_partitions: 3,
                    replication_factor: 1
                }, 10000, (err) => {
                    if (err && err.code !== Kafka.CODES.ERRORS.ERR_TOPIC_ALREADY_EXISTS) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        };

        await createTopic(this.config.topic);
        await createTopic(this.config.topic2);
        admin.disconnect();
    }

    /**
     * Run producer benchmark using raw rdkafka API.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runProducer() {
        return new Promise((resolve, reject) => {
            const messageBuffer = crypto.randomBytes(this.config.message.size);
            const totalMessages = this.config.stopping.messageCount;
            let messagesSent = 0;
            let deliveryCount = 0;
            let startTime;

            const producer = new Kafka.Producer({
                'metadata.broker.list': this.config.brokers,
                'compression.codec': this.config.producer.compression,
                'queue.buffering.max.messages': 100000,
                'queue.buffering.max.ms': 1000,
                'batch.num.messages': this.config.producer.batchSize,
                'dr_cb': true
            });

            producer.on('delivery-report', (err, report) => {
                if (err) {
                    console.error('Delivery error:', err);
                }
                deliveryCount++;

                if (deliveryCount >= totalMessages) {
                    const endTime = process.hrtime.bigint();
                    const durationMs = Number(endTime - startTime) / 1e6;
                    const totalBytes = totalMessages * this.config.message.size;
                    const throughputMbps = (totalBytes / durationMs) * 1000 / (1024 * 1024);
                    const messagesPerSecond = (totalMessages / durationMs) * 1000;

                    producer.disconnect(() => {
                        resolve({
                            type: 'producer',
                            timestamp: new Date().toISOString(),
                            duration_ms: durationMs,
                            messages: totalMessages,
                            bytes: totalBytes,
                            throughput_mbps: throughputMbps,
                            messages_per_second: messagesPerSecond,
                            config: {
                                batch_size: this.config.producer.batchSize,
                                compression: this.config.producer.compression,
                                message_size: this.config.message.size
                            }
                        });
                    });
                }
            });

            producer.on('ready', () => {
                // Send warmup messages
                for (let i = 0; i < this.config.producer.warmupMessages; i++) {
                    try {
                        producer.produce(this.config.topic, null, messageBuffer, null, Date.now());
                    } catch (err) {
                        if (err.code !== Kafka.CODES.ERRORS.ERR__QUEUE_FULL) {
                            console.error('Warmup error:', err);
                        }
                    }
                }

                // Wait for warmup to complete, then start measurement
                setTimeout(() => {
                    startTime = process.hrtime.bigint();
                    deliveryCount = 0;

                    const sendMessages = () => {
                        while (messagesSent < totalMessages) {
                            try {
                                producer.produce(this.config.topic, null, messageBuffer, null, Date.now());
                                messagesSent++;
                            } catch (err) {
                                if (err.code === Kafka.CODES.ERRORS.ERR__QUEUE_FULL) {
                                    producer.poll();
                                    setTimeout(sendMessages, 10);
                                    return;
                                }
                                throw err;
                            }
                        }
                        producer.flush(30000, (err) => {
                            if (err) console.error('Flush error:', err);
                        });
                    };

                    sendMessages();
                }, 1000);
            });

            producer.on('event.error', (err) => {
                console.error('Producer error:', err);
                reject(err);
            });

            producer.connect();
            producer.setPollInterval(100);
        });
    }

    /**
     * Run consumer benchmark using raw rdkafka API.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runConsumer() {
        return new Promise((resolve, reject) => {
            const totalMessages = this.config.stopping.messageCount;
            const skippedMessages = 100;
            let messagesReceived = 0;
            let messagesMeasured = 0;
            let totalBytes = 0;
            let startTime;

            const consumer = new Kafka.KafkaConsumer({
                'metadata.broker.list': this.config.brokers,
                'group.id': 'benchmark-' + Date.now(),
                'fetch.wait.max.ms': 100,
                'fetch.message.max.bytes': 1024 * 1024,
                'enable.auto.commit': false,
                'auto.offset.reset': 'earliest'
            });

            consumer.on('data', (message) => {
                messagesReceived++;

                if (messagesReceived > skippedMessages) {
                    if (!startTime) {
                        startTime = process.hrtime.bigint();
                    }
                    messagesMeasured++;
                    totalBytes += message.value.length;

                    if (messagesMeasured >= totalMessages) {
                        const endTime = process.hrtime.bigint();
                        const durationMs = Number(endTime - startTime) / 1e6;
                        const throughputMbps = (totalBytes / durationMs) * 1000 / (1024 * 1024);
                        const messagesPerSecond = (messagesMeasured / durationMs) * 1000;

                        consumer.disconnect(() => {
                            resolve({
                                type: 'consumer',
                                timestamp: new Date().toISOString(),
                                duration_ms: durationMs,
                                messages: messagesMeasured,
                                bytes: totalBytes,
                                throughput_mbps: throughputMbps,
                                messages_per_second: messagesPerSecond,
                                config: {
                                    message_count: totalMessages
                                }
                            });
                        });
                    }
                }
            });

            consumer.on('ready', () => {
                consumer.subscribe([this.config.topic]);
                consumer.consume();
            });

            consumer.on('event.error', (err) => {
                console.error('Consumer error:', err);
                reject(err);
            });

            consumer.connect();
        });
    }

    /**
     * Run consume-transform-produce benchmark.
     * Note: This is a simplified version; for full CTP use confluent client.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runCTP() {
        // For CTP, delegate to the primitives since it requires both producer and consumer coordination
        const ConfluentClient = require('./confluent-client');
        const confluentClient = new ConfluentClient(this.config);
        return confluentClient.runCTP();
    }

    /**
     * Run end-to-end latency benchmark.
     * Note: Uses confluent client for accurate latency measurement.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runLatency() {
        // For latency, delegate to the primitives
        const ConfluentClient = require('./confluent-client');
        const confluentClient = new ConfluentClient(this.config);
        return confluentClient.runLatency();
    }

    /**
     * Seed topic with messages for consumer benchmark.
     * @returns {Promise<void>}
     */
    async seedTopic() {
        const result = await this.runProducer();
        console.log(`Seeded topic with ${result.messages} messages`);
    }
}

module.exports = RdKafkaClient;
