#!/usr/bin/env node

const { exec } = require('child_process');

async function runCommand(command) {
  try {
    const output = await exec(command, { encoding: 'utf8', stdio: 'pipe' });
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




async function main() {
  // Run performance tests and store outputs in memory
  const messageCount = process.env.MESSAGE_COUNT ? +process.env.MESSAGE_COUNT : 50000;
  const skipCtpTest = process.env.SKIP_CTP_TEST ? process.env.SKIP_CTP_TEST === 'true' : false;
  const concurrentRun = process.env.CONCURRENT_RUN ? process.env.CONCURRENT_RUN === 'true' : false;
  const consumerMode = process.env.CONSUMER_MODE || 'all';
  const produceToSecondTopic = process.env.PRODUCE_TO_SECOND_TOPIC ? process.env.PRODUCE_TO_SECOND_TOPIC === 'true' : false;
  const produceToSecondTopicParam = produceToSecondTopic ? '--produce-to-second-topic' : '';
  const consumerModeAll = consumerMode === 'all';
  const consumerModeEachMessage = consumerMode === 'eachMessage';
  const consumerModeEachBatch = consumerMode === 'eachBatch';
  let consumerParam = '--consumer';
  if (consumerModeEachMessage) {
    consumerParam = '--consumer-each-message';
  } else if (consumerModeEachBatch) {
    consumerParam = '--consumer-each-batch';
  }
  let outputConfluentProducerConsumer;
  let outputKjsProducerConsumer;

  const runProducerConsumerMode = async () => {
    const modeLabel = mode === 'confluent' ? 'Confluent' : 'KafkaJS';
    if (concurrentRun) {
      console.log(`Running ${modeLabel} Producer/Consumer test (concurrently)...`);
      await runCommand(`MODE=${mode} node performance-consolidated.js --create-topics`);
      const allPromises = [];
      allPromises.push(runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} node performance-consolidated.js --producer`));
      if (consumerModeAll || consumerModeEachBatch)
        allPromises.push(runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} node performance-consolidated.js --consumer-each-batch ${produceToSecondTopicParam} --consumer`));
      if (consumerModeAll || consumerModeEachMessage)
        allPromises.push(runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} node performance-consolidated.js --consumer-each-message ${produceToSecondTopicParam} --consumer`));
      const results = await Promise.allSettled(allPromises);
      return results.map(r => r.status === 'fulfilled' ? r.value : '').join('\n');
    } else {
      console.log(`Running ${modeLabel} Producer/Consumer test...`);
      return runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} node performance-consolidated.js --create-topics ${consumerParam} ${produceToSecondTopicParam} --producer`);
    }
  }

  const runProducerConsumer = async (concurrentRun) => {
    outputConfluentProducerConsumer = await runProducerConsumerMode('confluent', concurrentRun);
    outputKjsProducerConsumer = await runProducerConsumerMode('kafkajs', concurrentRun);
  }

  await runProducerConsumer();

  console.log('Running Confluent CTP test...');
  const outputConfluentCtp = skipCtpTest ? '' :
    runCommand('MODE=confluent MESSAGE_COUNT=5000 node performance-consolidated.js --create-topics --ctp');

  console.log('Running KafkaJS CTP test...');
  const outputKjsCtp = skipCtpTest ? '' :
    runCommand('MODE=kafkajs MESSAGE_COUNT=5000 node performance-consolidated.js --create-topics --ctp');

  // Extract Confluent results
  let ctpConfluent, ctpKjs;
  let consumerConfluentMessage;
  let consumerConfluentMessageRate;
  let consumerConfluentMessageAvgLatency;
  let consumerConfluentMessageMaxLatency;
  let consumerConfluentTime;
  let consumerConfluentBatch;
  let consumerConfluentBatchRate;
  let consumerConfluentBatchAvgLatency;
  let consumerConfluentBatchMaxLatency;
  let consumerConfluentBatchTime;
  let consumerConfluentBatchAverageLag;
  let consumerConfluentBatchMaxLag;
  let consumerConfluentBatchAverageSize;

  const producerConfluent = extractValue(outputConfluentProducerConsumer, '=== Producer Rate:');
  if (consumerModeAll || consumerModeEachMessage) {
    consumerConfluentMessage = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate MB/s (eachMessage):');
    consumerConfluentMessageRate = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate msg/s (eachMessage):');
    consumerConfluentMessageAvgLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency (eachMessage):');
    consumerConfluentMessageMaxLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency (eachMessage):');
    consumerConfluentTime = extractValue(outputConfluentProducerConsumer, '=== Consumption time (eachMessage):');
  }
  if (consumerModeAll || consumerModeEachBatch) {
    consumerConfluentBatch = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate MB/s (eachBatch):');
    consumerConfluentBatchRate = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate msg/s (eachBatch):');
    consumerConfluentBatchAvgLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency (eachBatch):');
    consumerConfluentBatchMaxLatency = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency (eachBatch):');
    consumerConfluentBatchTime = extractValue(outputConfluentProducerConsumer, '=== Consumption time (eachBatch):');
    consumerConfluentBatchAverageLag = extractValue(outputConfluentProducerConsumer, '=== Average eachBatch lag:');
    consumerConfluentBatchMaxLag = extractValue(outputConfluentProducerConsumer, '=== Max eachBatch lag:');
    consumerConfluentBatchAverageSize = extractValue(outputConfluentProducerConsumer, '=== Average eachBatch size:');
  }
  const consumerConfluentAverageRSS = extractValue(outputConfluentProducerConsumer, '=== Max Average RSS across tests:');
  const consumerConfluentMaxRSS = extractValue(outputConfluentProducerConsumer, '=== Max RSS across tests:');
  if (!skipCtpTest) {
    ctpConfluent = extractValue(outputConfluentCtp, '=== Consume-Transform-Produce Rate:');
  }

  // Extract KafkaJS results
  let consumerKjsMessage;
  let consumerKjsMessageRate;
  let consumerKjsMessageAvgLatency;
  let consumerKjsMessageMaxLatency;
  let consumerKjsTime;
  let consumerKjsBatch;
  let consumerKjsBatchRate;
  let consumerKjsBatchAvgLatency;
  let consumerKjsBatchMaxLatency;
  let consumerKjsBatchTime;
  let consumerKjsBatchAverageLag;
  let consumerKjsBatchMaxLag;
  let consumerKjsBatchAverageSize;
  const producerKjs = extractValue(outputKjsProducerConsumer, '=== Producer Rate:');
  if (consumerModeAll || consumerModeEachMessage) {
    consumerKjsMessage = extractValue(outputKjsProducerConsumer, '=== Consumer Rate MB/s (eachMessage):');
    consumerKjsMessageRate = extractValue(outputKjsProducerConsumer, '=== Consumer Rate msg/s (eachMessage):');
    consumerKjsMessageAvgLatency = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency (eachMessage):');
    consumerKjsMessageMaxLatency = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency (eachMessage):');
  }
  if (consumerModeAll || consumerModeEachBatch) {
    consumerKjsTime = extractValue(outputKjsProducerConsumer, '=== Consumption time (eachMessage):');
    consumerKjsBatch = extractValue(outputKjsProducerConsumer, '=== Consumer Rate MB/s (eachBatch):');
    consumerKjsBatchRate = extractValue(outputKjsProducerConsumer, '=== Consumer Rate msg/s (eachBatch):');
    consumerKjsBatchAvgLatency = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency (eachBatch):');
    consumerKjsBatchMaxLatency = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency (eachBatch):');
    consumerKjsBatchTime = extractValue(outputKjsProducerConsumer, '=== Consumption time (eachBatch):');
    consumerKjsBatchAverageLag = extractValue(outputKjsProducerConsumer, '=== Average eachBatch lag:');
    consumerKjsBatchMaxLag = extractValue(outputKjsProducerConsumer, '=== Max eachBatch lag:');
    consumerKjsBatchAverageSize = extractValue(outputKjsProducerConsumer, '=== Average eachBatch size:');
  }
  const consumerKjsAverageRSS = extractValue(outputKjsProducerConsumer, '=== Max Average RSS across tests:');
  const consumerKjsMaxRSS = extractValue(outputKjsProducerConsumer, '=== Max RSS across tests:');
  if (!skipCtpTest) {
    ctpKjs = extractValue(outputKjsCtp, '=== Consume-Transform-Produce Rate:');
  }

  // Print results
  console.log(`Producer rates: confluent ${producerConfluent}, kafkajs ${producerKjs}`);
  if (consumerModeAll || consumerModeEachMessage) {
    console.log(`Consumer rates MB/s (eachMessage): confluent ${consumerConfluentMessage}, kafkajs ${consumerKjsMessage}`);
    console.log(`Consumer rates msg/s (eachMessage): confluent ${consumerConfluentMessageRate}, kafkajs ${consumerKjsMessageRate}`);
    console.log(`Consumer average E2E latency (eachMessage): confluent ${consumerConfluentMessageAvgLatency}, kafkajs ${consumerKjsMessageAvgLatency}`);
    console.log(`Consumer max E2E latency (eachMessage): confluent ${consumerConfluentMessageMaxLatency}, kafkajs ${consumerKjsMessageMaxLatency}`);
    console.log(`Consumption time (eachMessage): confluent ${consumerConfluentTime}, kafkajs ${consumerKjsTime}`);
  }
  if (consumerModeAll || consumerModeEachBatch) {
    console.log(`Consumer rates MB/s (eachBatch): confluent ${consumerConfluentBatch}, kafkajs ${consumerKjsBatch}`);
    console.log(`Consumer rates msg/s (eachBatch): confluent ${consumerConfluentBatchRate}, kafkajs ${consumerKjsBatchRate}`);
    console.log(`Consumer average E2E latency (eachBatch): confluent ${consumerConfluentBatchAvgLatency}, kafkajs ${consumerKjsBatchAvgLatency}`);
    console.log(`Consumer max E2E latency (eachBatch): confluent ${consumerConfluentBatchMaxLatency}, kafkajs ${consumerKjsBatchMaxLatency}`);
    console.log(`Consumption time (eachBatch): confluent ${consumerConfluentBatchTime}, kafkajs ${consumerKjsBatchTime}`);
    console.log(`Average eachBatch lag: confluent ${consumerConfluentBatchAverageLag}, kafkajs ${consumerKjsBatchAverageLag}`);
    console.log(`Max eachBatch lag: confluent ${consumerConfluentBatchMaxLag}, kafkajs ${consumerKjsBatchMaxLag}`);
    console.log(`Average eachBatch size: confluent ${consumerConfluentBatchAverageSize}, kafkajs ${consumerKjsBatchAverageSize}`);
  }
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

  if (consumerModeAll || consumerModeEachMessage) {
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
  }

  if (consumerModeAll || consumerModeEachBatch) {
    if (belowThreshold(consumerConfluentBatch, consumerKjsBatch, maxPerformanceDifference)) {
      console.log(`Consumer rates (eachBatch) differ by more than 30%: confluent ${consumerConfluentBatch}, kafkajs ${consumerKjsBatch}`);
      errcode = 0;
    }

    // Lower is better for time
    if (belowThreshold(consumerKjsBatchTime, consumerConfluentBatchTime, maxPerformanceDifference)) {
      console.log(`Consumption time (eachBatch) differ by more than 30%: confluent ${consumerConfluentBatchTime}, kafkajs ${consumerKjsBatchTime}`);
      errcode = 0;
    }
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

  if ((consumerModeAll || consumerModeEachMessage) && belowTarget(consumerConfluentMessage, TARGET_CONSUME)) {
    console.log(`Confluent consumer rate (eachMessage) is below target: ${consumerConfluentMessage}`);
    errcode = 1;
  }

  if ((consumerModeAll || consumerModeEachBatch) && belowTarget(consumerConfluentBatch, TARGET_CONSUME)) {
    console.log(`Confluent consumer rate (eachBatch) is below target: ${consumerConfluentBatch}`);
    errcode = 1;
  }

  if (!skipCtpTest && belowTarget(ctpConfluent, TARGET_CTP)) {
    console.log(`Confluent CTP rate is below target: ${ctpConfluent}`);
    errcode = 1;
  }

  process.exit(errcode);
}

if (require.main === module)
  main();