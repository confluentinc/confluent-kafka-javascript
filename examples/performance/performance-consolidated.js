const fs = require('fs');
const mode = process.env.MODE ? process.env.MODE : 'confluent';

let runProducer, runConsumer, runConsumeTransformProduce, runCreateTopics, runProducerConsumerTogether;
if (mode === 'confluent') {
    ({ runProducer, runConsumer, runConsumeTransformProduce, runCreateTopics, runProducerConsumerTogether } = require('./performance-primitives'));
} else {
    ({ runProducer, runConsumer, runConsumeTransformProduce, runProducerConsumerTogether } = require('./performance-primitives-kafkajs'));
    /* createTopics is more reliable in CKJS */
    ({ runCreateTopics } = require('./performance-primitives'));
}

const brokers = process.env.KAFKA_BROKERS || 'localhost:9092';
const securityProtocol = process.env.SECURITY_PROTOCOL;
const saslUsername = process.env.SASL_USERNAME;
const saslPassword = process.env.SASL_PASSWORD;
const topic = process.env.KAFKA_TOPIC || 'test-topic';
const topic2 = process.env.KAFKA_TOPIC2 || 'test-topic2';
const messageCount = process.env.MESSAGE_COUNT ? +process.env.MESSAGE_COUNT : 1000000;
const messageSize = process.env.MESSAGE_SIZE ? +process.env.MESSAGE_SIZE : 256;
const batchSize = process.env.BATCH_SIZE ? +process.env.BATCH_SIZE : 100;
const compression = process.env.COMPRESSION || 'None';
// Between 0 and 1, percentage of random bytes in each message
const randomness = process.env.RANDOMNESS ? +process.env.RANDOMNESS : 0.5;
const numPartitions = process.env.PARTITIONS ? +process.env.PARTITIONS : 3;
const partitionsConsumedConcurrently = process.env.PARTITIONS_CONSUMED_CONCURRENTLY ? +process.env.PARTITIONS_CONSUMED_CONCURRENTLY : 1;
const warmupMessages = process.env.WARMUP_MESSAGES ? +process.env.WARMUP_MESSAGES : (batchSize * 10);
const messageProcessTimeMs = process.env.MESSAGE_PROCESS_TIME_MS ? +process.env.MESSAGE_PROCESS_TIME_MS : 5;
const ctpConcurrency = process.env.CONSUME_TRANSFORM_PRODUCE_CONCURRENCY ? +process.env.CONSUME_TRANSFORM_PRODUCE_CONCURRENCY : 1;
const consumerProcessingTime = process.env.CONSUMER_PROCESSING_TIME ? +process.env.CONSUMER_PROCESSING_TIME : 100;
const producerProcessingTime = process.env.PRODUCER_PROCESSING_TIME ? +process.env.PRODUCER_PROCESSING_TIME : 100;
const parameters = {
    brokers,
    securityProtocol,
    saslUsername,
    saslPassword,
}

function logParameters(parameters) {
    console.log(`  Brokers: ${parameters.brokers}`);
    if (parameters.securityProtocol && parameters.saslUsername && parameters.saslPassword) {
        console.log(`  Security Protocol: ${parameters.securityProtocol}`);
        console.log(`  SASL Username: ${parameters.saslUsername ? parameters.saslUsername : 'not set'}`);
        console.log(`  SASL Password: ${parameters.saslPassword ? '******' : 'not set'}`);
    } else {
        console.log("  No security protocol configured");
    }
}

(async function () {
    const producer = process.argv.includes('--producer');
    const consumer = process.argv.includes('--consumer');
    const ctp = process.argv.includes('--ctp');
    const produceConsumeLatency = process.argv.includes('--latency');
    const all = process.argv.includes('--all');
    const createTopics = process.argv.includes('--create-topics');
    let maxAverageRSSKB, maxMaxRSSKB;
    const stats = {};

    let measures = [];
    let interval;
    const startTrackingMemory = () => {
        interval = setInterval(() => {
            measures.push({ rss: process.memoryUsage().rss,
                            timestamp: Date.now() });
        }, 100);
    };

    const datapointToJSON = (m) =>
        ({ rss: m.rss.toString(), timestamp: m.timestamp.toString() });

    const endTrackingMemory = (fileName) => {
        clearInterval(interval);
        interval = null;
        const averageRSS = measures.reduce((sum, m) => sum + m.rss, 0) / measures.length;
        const averageRSSKB = averageRSS / 1024;
        maxAverageRSSKB = !maxAverageRSSKB ? averageRSSKB : Math.max(averageRSSKB, maxAverageRSSKB);
        console.log(`=== Average RSS: ${averageRSSKB} KB`);
        const max = measures.reduce((prev, current) => (prev.rss > current.rss) ? prev : current);
        const maxRSSKB = max.rss / 1024;
        maxMaxRSSKB = !maxMaxRSSKB ? maxRSSKB : Math.max(maxRSSKB, maxMaxRSSKB);
        console.log(`=== Max RSS: ${maxRSSKB} KB at ${new Date(max.timestamp).toISOString()}`);
        if (fileName) {
            const measuresJSON = JSON.stringify({
                measures: measures.map(datapointToJSON),
                averageRSS: averageRSS.toString(),
                maxRSS: datapointToJSON(max)
            }, null, 2);
            fs.writeFileSync(fileName, measuresJSON);
        }
        measures = [];
    }

    console.log(`=== Starting Performance Tests - Mode ${mode} ===`);

    if (createTopics || all) {
        console.log("=== Creating Topics (deleting if they exist already):");
        logParameters(parameters);
        console.log(`  Topic: ${topic}`);
        console.log(`  Topic2: ${topic2}`);
        console.log(`  Partitions: ${numPartitions}`);
        await runCreateTopics(parameters, topic, topic2, numPartitions);
    }

    if (producer || all) {
        console.log("=== Running Basic Producer Performance Test:")
        logParameters(parameters);
        console.log(`  Topic: ${topic}`);
        console.log(`  Message Count: ${messageCount}`);
        console.log(`  Message Size: ${messageSize}`);
        console.log(`  Batch Size: ${batchSize}`);
        console.log(`  Compression: ${compression}`);
        console.log(`  Warmup Messages: ${warmupMessages}`);
        startTrackingMemory();
        const producerRate = await runProducer(parameters, topic, batchSize,
            warmupMessages, messageCount, messageSize, compression, randomness);
        endTrackingMemory(`producer-memory-${mode}.json`);
        console.log("=== Producer Rate: ", producerRate);
    }

    if (consumer || all) {
        // If user runs this without --producer then they are responsible for seeding the topic.
        console.log("=== Running Basic Consumer Performance Test (eachMessage):")
        logParameters(parameters);
        console.log(`  Topic: ${topic}`);
        console.log(`  Message Count: ${messageCount}`);
        console.log(`  Partitions consumed concurrently: ${partitionsConsumedConcurrently}`);
        startTrackingMemory();
        const consumerRate = await runConsumer(parameters, topic,
            warmupMessages, messageCount,
            false, partitionsConsumedConcurrently, stats);
        endTrackingMemory(`consumer-memory-message-${mode}.json`);
        console.log("=== Consumer Rate MB/s (eachMessage): ", consumerRate);
        console.log("=== Consumer Rate msg/s (eachMessage): ", stats.messageRate);
        console.log("=== Consumption time (eachMessage): ", stats.durationSeconds);
    }

    if (consumer || all) {
        // If user runs this without --producer then they are responsible for seeding the topic.
        console.log("=== Running Basic Consumer Performance Test (eachBatch):")
        logParameters(parameters);
        console.log(`  Topic: ${topic}`);
        console.log(`  Message Count: ${messageCount}`);
        console.log(`  Partitions consumed concurrently: ${partitionsConsumedConcurrently}`);
        startTrackingMemory();
        const consumerRate = await runConsumer(parameters, topic,
            warmupMessages, messageCount,
            true, partitionsConsumedConcurrently, stats);
        endTrackingMemory(`consumer-memory-batch-${mode}.json`);
        console.log("=== Consumer Rate MB/s (eachBatch): ", consumerRate);
        console.log("=== Consumer Rate msg/s (eachBatch): ", stats.messageRate);
        console.log("=== Average eachBatch lag: ", stats.averageOffsetLag);
        console.log("=== Max eachBatch lag: ", stats.maxOffsetLag);
        console.log("=== Average eachBatch size: ", stats.averageBatchSize);
        console.log("=== Consumption time (eachBatch): ", stats.durationSeconds);
    }

    if (ctp || all) {
        console.log("=== Running Consume-Transform-Produce Performance Test:")
        logParameters(parameters);
        console.log(`  ConsumeTopic: ${topic}`);
        console.log(`  ProduceTopic: ${topic2}`);
        console.log(`  Message Count: ${messageCount}`);
        // Seed the topic with messages
        await runProducer(parameters, topic, batchSize, warmupMessages, messageCount, messageSize, compression);
        startTrackingMemory();
        const ctpRate = await runConsumeTransformProduce(parameters, topic, topic2, warmupMessages, messageCount, messageProcessTimeMs, ctpConcurrency);
        endTrackingMemory(`consume-transform-produce-${mode}.json`);
        console.log("=== Consume-Transform-Produce Rate: ", ctpRate);
    }

    if (produceConsumeLatency || all) {
        console.log("=== Running Produce-To-Consume Latency Performance Test:")
        logParameters(parameters);
        console.log(`  Topic: ${topic}`);
        console.log(`  Message Count: ${messageCount}`);
        console.log(`  Consumer Processing Time: ${consumerProcessingTime}`);
        console.log(`  Producer Processing Time: ${producerProcessingTime}`);
        startTrackingMemory();
        const { mean, p50, p90, p95, outliers } = await runProducerConsumerTogether(parameters, topic, messageCount, messageSize, producerProcessingTime, consumerProcessingTime);
        endTrackingMemory(`producer-consumer-together-${mode}.json`);
        console.log(`=== Produce-To-Consume Latency (ms): Mean: ${mean}, P50: ${p50}, P90: ${p90}, P95: ${p95}`);

        // The presence of outliers invalidates the mean measurement, and rasies concerns as to why there are any.
        // Ideally, the test should not have outliers if consumer processing time is less or equal to producer processing time.
        if (outliers.length > 0) {
            console.log("=== Outliers (ms): ", outliers);
        }
    }

    if (maxAverageRSSKB !== undefined && maxMaxRSSKB !== undefined) {
        console.log(`=== Max Average RSS across tests: `, maxAverageRSSKB);
        console.log(`=== Max RSS across tests: `, maxMaxRSSKB);
    }
})();