'use strict';

/**
 * Abstract base class for benchmark clients.
 * Defines the interface that all client implementations must follow.
 */
class BenchmarkClient {
    constructor(config) {
        if (new.target === BenchmarkClient) {
            throw new Error('BenchmarkClient is abstract and cannot be instantiated directly');
        }
        this.config = config;
    }

    /**
     * Get the client name/type.
     * @returns {string}
     */
    get name() {
        throw new Error('Subclass must implement name getter');
    }

    /**
     * Create topics for benchmarking.
     * @returns {Promise<void>}
     */
    async createTopics() {
        throw new Error('Subclass must implement createTopics()');
    }

    /**
     * Run producer benchmark.
     * @returns {Promise<ProducerResult>}
     */
    async runProducer() {
        throw new Error('Subclass must implement runProducer()');
    }

    /**
     * Run consumer benchmark.
     * @returns {Promise<ConsumerResult>}
     */
    async runConsumer() {
        throw new Error('Subclass must implement runConsumer()');
    }

    /**
     * Run consume-transform-produce benchmark.
     * @returns {Promise<Object>}
     */
    async runCTP() {
        throw new Error('Subclass must implement runCTP()');
    }

    /**
     * Run end-to-end latency benchmark.
     * @returns {Promise<Object>}
     */
    async runLatency() {
        throw new Error('Subclass must implement runLatency()');
    }

    /**
     * Seed topic with messages for consumer benchmark.
     * @returns {Promise<void>}
     */
    async seedTopic() {
        throw new Error('Subclass must implement seedTopic()');
    }
}

/**
 * Producer result structure.
 * @typedef {Object} ProducerResult
 * @property {string} type - 'producer'
 * @property {string} timestamp - ISO timestamp
 * @property {number} duration_ms - Total duration in milliseconds
 * @property {number} messages - Messages sent
 * @property {number} bytes - Bytes sent
 * @property {number} throughput_mbps - Throughput in MB/s
 * @property {number} messages_per_second - Messages per second
 * @property {number} msgs_delivered - Messages with delivery confirmation
 * @property {number} msgs_failed - Messages that failed delivery
 * @property {Object} delivery_latency - Delivery report latency stats
 * @property {number} delivery_latency.avg_us - Average latency in microseconds
 * @property {number} delivery_latency.p50_us - P50 latency
 * @property {number} delivery_latency.p95_us - P95 latency
 * @property {number} delivery_latency.p99_us - P99 latency
 * @property {number} delivery_latency.min_us - Min latency
 * @property {number} delivery_latency.max_us - Max latency
 * @property {Object} resources - Resource usage during run
 * @property {Object} config - Configuration used
 */

/**
 * Consumer result structure.
 * @typedef {Object} ConsumerResult
 * @property {string} type - 'consumer'
 * @property {string} timestamp - ISO timestamp
 * @property {number} duration_ms - Total duration in milliseconds
 * @property {number} messages - Messages consumed
 * @property {number} bytes - Bytes consumed
 * @property {number} throughput_mbps - Throughput in MB/s
 * @property {number} messages_per_second - Messages per second
 * @property {Object} e2e_latency - End-to-end latency stats (if measured)
 * @property {number} e2e_latency.avg_ms - Average latency in milliseconds
 * @property {number} e2e_latency.p50_ms - P50 latency
 * @property {number} e2e_latency.p95_ms - P95 latency
 * @property {number} e2e_latency.p99_ms - P99 latency
 * @property {number} e2e_latency.min_ms - Min latency
 * @property {number} e2e_latency.max_ms - Max latency
 * @property {number} consumer_lag - Consumer lag at end of run
 * @property {Object} resources - Resource usage during run
 * @property {Object} config - Configuration used
 */

module.exports = {
    BenchmarkClient
};
