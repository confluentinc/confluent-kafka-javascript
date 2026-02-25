'use strict';

/**
 * Default configuration values for benchmarks.
 */
const defaults = {
    // Connection
    brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
    topic: process.env.KAFKA_TOPIC || 'benchmark-topic',
    topic2: process.env.KAFKA_TOPIC2 || 'benchmark-topic2',

    // Stopping mode
    stopping: {
        mode: 'count',  // 'count' or 'time'
        messageCount: parseInt(process.env.MESSAGE_COUNT, 10) || 100000,
        durationSeconds: parseInt(process.env.DURATION_SECONDS, 10) || 60
    },

    // Producer settings
    producer: {
        batchSize: parseInt(process.env.BATCH_SIZE, 10) || 100,
        compression: process.env.COMPRESSION || 'none',
        warmupMessages: parseInt(process.env.WARMUP_MESSAGES, 10) || 1000,
        lingerMs: 5,
        acks: 'all'
    },

    // Consumer settings
    consumer: {
        fetchMinBytes: 1,
        fetchWaitMaxMs: 500,
        autoCommit: false
    },

    // Message settings
    message: {
        size: parseInt(process.env.MESSAGE_SIZE, 10) || 256,
        keySize: 16
    },

    // CTP settings
    ctp: {
        processTimeMs: parseInt(process.env.MESSAGE_PROCESS_TIME_MS, 10) || 5,
        concurrency: parseInt(process.env.CTP_CONCURRENCY, 10) || 1
    },

    // Latency settings
    latency: {
        messageCount: parseInt(process.env.LATENCY_MESSAGE_COUNT, 10) || 1000,
        producerDelayMs: parseInt(process.env.PRODUCER_PROCESSING_TIME, 10) || 10,
        consumerDelayMs: parseInt(process.env.CONSUMER_PROCESSING_TIME, 10) || 10
    },

    // Run settings
    runs: parseInt(process.env.BENCHMARK_RUNS, 10) || 3,
    warmupRuns: 0,

    // Client mode
    mode: process.env.BENCHMARK_MODE || 'confluent',

    // Output settings
    outputDir: process.env.OUTPUT_DIR || './results',
    json: false,
    csv: false,
    html: false,
    quiet: false,
    createTopics: false
};

/**
 * Deep merge two objects.
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function deepMerge(target, source) {
    const result = { ...target };

    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else if (source[key] !== undefined) {
            result[key] = source[key];
        }
    }

    return result;
}

/**
 * Merge configuration with defaults.
 * @param {Object} config - User configuration
 * @returns {Object} - Merged configuration
 */
function mergeWithDefaults(config) {
    return deepMerge(defaults, config);
}

module.exports = {
    defaults,
    deepMerge,
    mergeWithDefaults
};
