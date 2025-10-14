#!/usr/bin/env node

const { execSync } = require('child_process');

function runCommand(command) {
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(output);
    return output;
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || error.message;
    console.log(error.stdout);
    console.log(error.stderr);
    console.log(error.message);
    return errorOutput;
  }
}

function extractValue(content, pattern) {
  try {
    const lines = content.split('\n');
    const matchingLine = lines.find(line => line.includes(pattern));
    if (matchingLine) {
      const value = matchingLine.split(':')[1]?.trim();
      return Number(value || '');
    }
    return NaN;
  } catch (error) {
    return NaN;
  }
}

function belowThreshold(value, target, threshold = 0.7) {
  if (isNaN(value) || isNaN(target))
    return false;
  return value < (target * threshold);
}

function belowTarget(value, target) {
  return belowThreshold(value, target, 1);
}

// Run performance tests and store outputs in memory
console.log('Running Confluent Producer/Consumer test...');
const messageCount = process.env.MESSAGE_COUNT ? +process.env.MESSAGE_COUNT : 50000;
const skipCtpTest = process.env.SKIP_CTP_TEST ? process.env.SKIP_CTP_TEST === 'true' : false;
const outputConfluentProducerConsumer = runCommand(`MODE=confluent MESSAGE_COUNT=${messageCount} node performance-consolidated.js --create-topics --consumer --producer`);

console.log('Running KafkaJS Producer/Consumer test...');
const outputKjsProducerConsumer = runCommand(`MODE=kafkajs MESSAGE_COUNT=${messageCount} node performance-consolidated.js --create-topics --consumer --producer`);

console.log('Running Confluent CTP test...');
const outputConfluentCtp = skipCtpTest ? '' :
  runCommand('MODE=confluent MESSAGE_COUNT=5000 node performance-consolidated.js --create-topics --ctp');

console.log('Running KafkaJS CTP test...');
const outputKjsCtp = skipCtpTest ? '' :
  runCommand('MODE=kafkajs MESSAGE_COUNT=5000 node performance-consolidated.js --create-topics --ctp');

// Extract Confluent results
let ctpConfluent, ctpKjs;
const producerConfluent = extractValue(outputConfluentProducerConsumer, '=== Producer Rate:');
const consumerConfluentMessage = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate MB/s (eachMessage):');
const consumerConfluentMessageRate = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate msg/s (eachMessage):');
const consumerConfluentMessageAvgLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency (eachMessage):');
const consumerConfluentMessageMaxLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency (eachMessage):');
const consumerConfluentTime = extractValue(outputConfluentProducerConsumer, '=== Consumption time (eachMessage):');
const consumerConfluentBatch = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate MB/s (eachBatch):');
const consumerConfluentBatchRate = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate msg/s (eachBatch):');
const consumerConfluentBatchAvgLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency (eachBatch):');
const consumerConfluentBatchMaxLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency (eachBatch):');
const consumerConfluentBatchTime = extractValue(outputConfluentProducerConsumer, '=== Consumption time (eachBatch):');
const consumerConfluentBatchAverageLag = extractValue(outputConfluentProducerConsumer, '=== Average eachBatch lag:');
const consumerConfluentBatchMaxLag = extractValue(outputConfluentProducerConsumer, '=== Max eachBatch lag:');
const consumerConfluentAverageRSS = extractValue(outputConfluentProducerConsumer, '=== Max Average RSS across tests:');
const consumerConfluentMaxRSS = extractValue(outputConfluentProducerConsumer, '=== Max RSS across tests:');
if (!skipCtpTest) {
  ctpConfluent = extractValue(outputConfluentCtp, '=== Consume-Transform-Produce Rate:');
}

// Extract KafkaJS results
const producerKjs = extractValue(outputKjsProducerConsumer, '=== Producer Rate:');
const consumerKjsMessage = extractValue(outputKjsProducerConsumer, '=== Consumer Rate MB/s (eachMessage):');
const consumerKjsMessageRate = extractValue(outputKjsProducerConsumer, '=== Consumer Rate msg/s (eachMessage):');
const consumerKjsMessageAvgLatency = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency (eachMessage):');
const consumerKjsMessageMaxLatency = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency (eachMessage):');
const consumerKjsTime = extractValue(outputKjsProducerConsumer, '=== Consumption time (eachMessage):');
const consumerKjsBatch = extractValue(outputKjsProducerConsumer, '=== Consumer Rate MB/s (eachBatch):');
const consumerKjsBatchRate = extractValue(outputKjsProducerConsumer, '=== Consumer Rate msg/s (eachBatch):');
const consumerKjsBatchAvgLatency = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency (eachBatch):');
const consumerKjsBatchMaxLatency = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency (eachBatch):');
const consumerKjsBatchTime = extractValue(outputKjsProducerConsumer, '=== Consumption time (eachBatch):');
const consumerKjsBatchAverageLag = extractValue(outputKjsProducerConsumer, '=== Average eachBatch lag:');
const consumerKjsBatchMaxLag = extractValue(outputKjsProducerConsumer, '=== Max eachBatch lag:');
const consumerKjsAverageRSS = extractValue(outputKjsProducerConsumer, '=== Max Average RSS across tests:');
const consumerKjsMaxRSS = extractValue(outputKjsProducerConsumer, '=== Max RSS across tests:');
if (!skipCtpTest) {
  ctpKjs = extractValue(outputKjsCtp, '=== Consume-Transform-Produce Rate:');
}

// Print results
console.log(`Producer rates: confluent ${producerConfluent}, kafkajs ${producerKjs}`);
console.log(`Consumer rates MB/s (eachMessage): confluent ${consumerConfluentMessage}, kafkajs ${consumerKjsMessage}`);
console.log(`Consumer rates msg/s (eachMessage): confluent ${consumerConfluentMessageRate}, kafkajs ${consumerKjsMessageRate}`);
console.log(`Consumer average E2E latency (eachMessage): confluent ${consumerConfluentMessageAvgLatency}, kafkajs ${consumerKjsMessageAvgLatency}`);
console.log(`Consumer max E2E latency (eachMessage): confluent ${consumerConfluentMessageMaxLatency}, kafkajs ${consumerKjsMessageMaxLatency}`);
console.log(`Consumption time (eachMessage): confluent ${consumerConfluentTime}, kafkajs ${consumerKjsTime}`);
console.log(`Consumer rates MB/s (eachBatch): confluent ${consumerConfluentBatch}, kafkajs ${consumerKjsBatch}`);
console.log(`Consumer rates msg/s (eachBatch): confluent ${consumerConfluentBatchRate}, kafkajs ${consumerKjsBatchRate}`);
console.log(`Consumer average E2E latency (eachBatch): confluent ${consumerConfluentBatchAvgLatency}, kafkajs ${consumerKjsBatchAvgLatency}`);
console.log(`Consumer max E2E latency (eachBatch): confluent ${consumerConfluentBatchMaxLatency}, kafkajs ${consumerKjsBatchMaxLatency}`);
console.log(`Consumption time (eachBatch): confluent ${consumerConfluentBatchTime}, kafkajs ${consumerKjsBatchTime}`);
console.log(`Average eachBatch lag: confluent ${consumerConfluentBatchAverageLag}, kafkajs ${consumerKjsBatchAverageLag}`);
console.log(`Max eachBatch lag: confluent ${consumerConfluentBatchMaxLag}, kafkajs ${consumerKjsBatchMaxLag}`);
console.log(`Average RSS: confluent ${consumerConfluentAverageRSS}, kafkajs ${consumerKjsAverageRSS}`);
console.log(`Max RSS: confluent ${consumerConfluentMaxRSS}, kafkajs ${consumerKjsMaxRSS}`);
if (!skipCtpTest) {
  console.log(`CTP rates: confluent ${ctpConfluent}, kafkajs ${ctpKjs}`);
}

let errcode = 0;
const maxPerformanceDifference = 0.7;

// Compare against KJS (30% threshold)
if (belowThreshold(producerConfluent, producerKjs, maxPerformanceDifference)) {
  console.log(`Producer rates differ by more than 30%: confluent ${producerConfluent}, kafkajs ${producerKjs}`);
  errcode = 1;
}

if (belowThreshold(consumerConfluentMessage, consumerKjsMessage, maxPerformanceDifference)) {
  console.log(`Consumer rates MB/s (eachMessage) differ by more than 30%: confluent ${consumerConfluentMessage}, kafkajs ${consumerKjsMessage}`);
  // FIXME: improve consumer performance at least to KafkaJS level
  errcode = 0;
}

// Lower is better for time
if (belowThreshold(consumerKjsTime, consumerConfluentTime, maxPerformanceDifference)) {
  console.log(`Consumption time (eachMessage) differ by more than 30%: confluent ${consumerConfluentTime}, kafkajs ${consumerKjsTime}`);
  errcode = 0;
}

if (belowThreshold(consumerConfluentBatch, consumerKjsBatch, maxPerformanceDifference)) {
  console.log(`Consumer rates (eachBatch) differ by more than 30%: confluent ${consumerConfluentBatch}, kafkajs ${consumerKjsBatch}`);
  errcode = 0;
}

// Lower is better for time
if (belowThreshold(consumerKjsBatchTime, consumerConfluentBatchTime, maxPerformanceDifference)) {
  console.log(`Consumption time (eachBatch) differ by more than 30%: confluent ${consumerConfluentBatchTime}, kafkajs ${consumerKjsBatchTime}`);
  errcode = 0;
}

if (!skipCtpTest && belowThreshold(ctpConfluent, ctpKjs, maxPerformanceDifference)) {
  console.log(`CTP rates differ by more than 30%: confluent ${ctpConfluent}, kafkajs ${ctpKjs}`);
  errcode = 1;
}

// Compare against target numbers
const TARGET_PRODUCE = process.env.TARGET_PRODUCE_PERFORMANCE || '35';
const TARGET_CONSUME = process.env.TARGET_CONSUME_PERFORMANCE || '18';
const TARGET_CTP = process.env.TARGET_CTP_PERFORMANCE || '0.02';

if (belowTarget(producerConfluent, TARGET_PRODUCE)) {
  console.log(`Confluent producer rate is below target: ${producerConfluent}`);
  errcode = 1;
}

if (belowTarget(consumerConfluentMessage, TARGET_CONSUME)) {
  console.log(`Confluent consumer rate is below target: ${consumerConfluentMessage}`);
  errcode = 1;
}

if (!skipCtpTest && belowTarget(ctpConfluent, TARGET_CTP)) {
  console.log(`Confluent CTP rate is below target: ${ctpConfluent}`);
  errcode = 1;
}

process.exit(errcode);