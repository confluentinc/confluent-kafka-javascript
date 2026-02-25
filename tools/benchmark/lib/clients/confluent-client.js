'use strict';

const path = require('path');

// Import the existing performance primitives
const primitives = require(path.join(__dirname, '..', '..', '..', '..', 'examples', 'performance', 'performance-primitives'));

/**
 * Map lowercase compression values to CompressionTypes key names.
 * CompressionTypes uses keys like 'None', 'GZIP', 'LZ4', etc.
 */
const COMPRESSION_MAP = {
    'none': 'None',
    'gzip': 'GZIP',
    'snappy': 'SNAPPY',
    'lz4': 'LZ4',
    'zstd': 'ZSTD'
};

/**
 * Confluent client implementation using KafkaJS-compatible API.
 * Wraps the existing performance-primitives.js functions.
 */
class ConfluentClient {
    constructor(config) {
        this.config = config;
        this.name = 'confluent';
    }

    /**
     * Get the compression key for CompressionTypes lookup.
     * @returns {string} - Compression key like 'None', 'GZIP', etc.
     */
    getCompressionKey() {
        const compression = this.config.producer.compression || 'none';
        return COMPRESSION_MAP[compression.toLowerCase()] || 'None';
    }

    /**
     * Create topics for benchmarking.
     * @returns {Promise<void>}
     */
    async createTopics() {
        await primitives.runCreateTopics(
            this.config.brokers,
            this.config.topic,
            this.config.topic2
        );
    }

    /**
     * Run producer benchmark.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runProducer() {
        const startTime = process.hrtime.bigint();

        const result = await primitives.runProducer(
            this.config.brokers,
            this.config.topic,
            this.config.producer.batchSize,
            this.config.producer.warmupMessages,
            this.config.stopping.messageCount,
            this.config.message.size,
            this.getCompressionKey()
        );

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;

        const totalMessages = this.config.stopping.messageCount;
        const totalBytes = totalMessages * this.config.message.size;
        const messagesPerSecond = (totalMessages / durationMs) * 1000;

        return {
            type: 'producer',
            timestamp: new Date().toISOString(),
            duration_ms: durationMs,
            messages: totalMessages,
            bytes: totalBytes,
            throughput_mbps: result.rate,
            messages_per_second: messagesPerSecond,
            latency: result.latency,  // Delivery report latency
            config: {
                batch_size: this.config.producer.batchSize,
                compression: this.config.producer.compression || 'none',
                message_size: this.config.message.size
            }
        };
    }

    /**
     * Run consumer benchmark.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runConsumer() {
        const startTime = process.hrtime.bigint();

        const throughputMbps = await primitives.runConsumer(
            this.config.brokers,
            this.config.topic,
            this.config.stopping.messageCount
        );

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;

        const totalMessages = this.config.stopping.messageCount;
        const messagesPerSecond = (totalMessages / durationMs) * 1000;

        return {
            type: 'consumer',
            timestamp: new Date().toISOString(),
            duration_ms: durationMs,
            messages: totalMessages,
            bytes: totalMessages * this.config.message.size,
            throughput_mbps: throughputMbps,
            messages_per_second: messagesPerSecond,
            config: {
                message_count: this.config.stopping.messageCount
            }
        };
    }

    /**
     * Run consume-transform-produce benchmark.
     * @returns {Promise<Object>} - Benchmark result
     */
    async runCTP() {
        const startTime = process.hrtime.bigint();

        const throughputMbps = await primitives.runConsumeTransformProduce(
            this.config.brokers,
            this.config.topic,
            this.config.topic2,
            this.config.producer.warmupMessages,
            this.config.stopping.messageCount,
            this.config.ctp.processTimeMs,
            this.config.ctp.concurrency
        );

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;

        const totalMessages = this.config.stopping.messageCount;
        const messagesPerSecond = (totalMessages / durationMs) * 1000;

        return {
            type: 'ctp',
            timestamp: new Date().toISOString(),
            duration_ms: durationMs,
            messages: totalMessages,
            bytes: totalMessages * this.config.message.size,
            throughput_mbps: throughputMbps,
            messages_per_second: messagesPerSecond,
            config: {
                process_time_ms: this.config.ctp.processTimeMs,
                concurrency: this.config.ctp.concurrency
            }
        };
    }

    /**
     * Run end-to-end latency benchmark.
     * @returns {Promise<Object>} - Benchmark result with latency percentiles
     */
    async runLatency() {
        const startTime = process.hrtime.bigint();

        // Use latency-specific message count if available, otherwise use stopping config
        const messageCount = this.config.latency.messageCount || this.config.stopping.messageCount;

        const latencyResult = await primitives.runProducerConsumerTogether(
            this.config.brokers,
            this.config.topic,
            messageCount,
            this.config.message.size,
            this.config.latency.producerDelayMs,
            this.config.latency.consumerDelayMs
        );

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;

        const totalMessages = messageCount;
        const messagesPerSecond = (totalMessages / durationMs) * 1000;

        // Calculate throughput from duration
        const totalBytes = totalMessages * this.config.message.size;
        const throughputMbps = (totalBytes / durationMs) * 1000 / (1024 * 1024);

        return {
            type: 'latency',
            timestamp: new Date().toISOString(),
            duration_ms: durationMs,
            messages: totalMessages,
            bytes: totalBytes,
            throughput_mbps: throughputMbps,
            messages_per_second: messagesPerSecond,
            latency: {
                mean: latencyResult.mean,
                p50: latencyResult.p50,
                p90: latencyResult.p90,
                p95: latencyResult.p95,
                outliers: latencyResult.outliers ? latencyResult.outliers.length : 0
            },
            config: {
                producer_delay_ms: this.config.latency.producerDelayMs,
                consumer_delay_ms: this.config.latency.consumerDelayMs
            }
        };
    }

    /**
     * Seed topic with messages for consumer benchmark.
     * @returns {Promise<void>}
     */
    async seedTopic() {
        await primitives.runProducer(
            this.config.brokers,
            this.config.topic,
            this.config.producer.batchSize,
            0, // No warmup for seeding
            this.config.stopping.messageCount + 100, // Extra messages
            this.config.message.size,
            this.getCompressionKey()
        );
    }
}

module.exports = ConfluentClient;
