#!/usr/bin/env node

const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function runCommand(command) {
  try {
    const output = await exec(command, { encoding: 'utf8', stdio: 'pipe' });
    return output.stdout;
  } catch (error) {
    return (error.stdout || '') + (error.stderr || '') + (error.message || '');
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
  let skipCtpTest = process.env.SKIP_CTP_TEST ? process.env.SKIP_CTP_TEST === 'true' : false;
  const concurrentRun = process.env.CONCURRENT_RUN ? process.env.CONCURRENT_RUN === 'true' : false;
  if (concurrentRun) {
    skipCtpTest = true;
  }
  if (!process.env.CONSUMER_MAX_BATCH_SIZE) {
    process.env.CONSUMER_MAX_BATCH_SIZE = '-1';
  }
  if (!process.env.PARTITIONS_CONSUMED_CONCURRENTLY) {
    process.env.PARTITIONS_CONSUMED_CONCURRENTLY = '2';
  }
  if (!process.env.COMPRESSION) {
    process.env.COMPRESSION = 'GZIP';
  }
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
  const groupIdEachMessageConfluent = `test-group-confluent-message-` + Math.random();
  const groupIdEachBatchConfluent = `test-group-confluent-batch-` + Math.random();
  const groupIdEachMessageKafkaJS = `test-group-kafkajs-message-` + Math.random();
  const groupIdEachBatchKafkaJS = `test-group-kafkajs-batch-` + Math.random();
  if (consumerModeAll || consumerModeEachMessage) {
    console.log(`Confluent eachMessage group id: ${groupIdEachMessageConfluent}`);
    console.log(`KafkaJS eachMessage group id: ${groupIdEachMessageKafkaJS}`);
  }
  if (consumerModeAll || consumerModeEachBatch) {
    console.log(`Confluent eachBatch group id: ${groupIdEachBatchConfluent}`);
    console.log(`KafkaJS eachBatch group id: ${groupIdEachBatchKafkaJS}`);
  }

  const runProducerConsumerMode = async (mode) => {
    const modeLabel = mode === 'confluent' ? 'Confluent' : 'KafkaJS';
    const groupIdEachMessage = mode === 'confluent' ? groupIdEachMessageConfluent : groupIdEachMessageKafkaJS;
    const groupIdEachBatch = mode === 'confluent' ? groupIdEachBatchConfluent : groupIdEachBatchKafkaJS;

    if (concurrentRun) {
      console.log(`Running ${modeLabel} Producer/Consumer test (concurrently)...`);
      const INITIAL_DELAY_MS = 10000;
      const TERMINATE_TIMEOUT_MS = process.env.TERMINATE_TIMEOUT_MS ? +process.env.TERMINATE_TIMEOUT_MS : 600000;
      // Wait INITIAL_DELAY_MS more to see if all lag is caught up, start earlier than the producer to check
      // E2E latencies more accurately.
      const TERMINATE_TIMEOUT_MS_CONSUMERS = TERMINATE_TIMEOUT_MS + INITIAL_DELAY_MS + 2000;
      const TERMINATE_TIMEOUT_MS_LAG_MONITORING = TERMINATE_TIMEOUT_MS + 1000;

      const createTopicResult = await runCommand(`MODE=${mode} node performance-consolidated.js --create-topics`);
      let ret = [createTopicResult];

      console.log(`Waiting 10s after topic creation before starting producer and consumers...`);
      await new Promise(resolve => setTimeout(resolve, 10000));

      console.log(`Starting producer and consumers...`);
      const allPromises = [];
      allPromises.push(runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} INITIAL_DELAY_MS=${INITIAL_DELAY_MS} node performance-consolidated.js --producer`));
      if (consumerModeAll || consumerModeEachMessage) {
        allPromises.push(runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} INITIAL_DELAY_MS=0 TERMINATE_TIMEOUT_MS=${TERMINATE_TIMEOUT_MS_CONSUMERS} GROUPID_MESSAGE=${groupIdEachMessage} node performance-consolidated.js --consumer-each-message ${produceToSecondTopicParam}`));
      }
      if (consumerModeAll || consumerModeEachBatch) {
        allPromises.push(runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} INITIAL_DELAY_MS=0 TERMINATE_TIMEOUT_MS=${TERMINATE_TIMEOUT_MS_CONSUMERS} GROUPID_BATCH=${groupIdEachBatch} node performance-consolidated.js --consumer-each-batch ${produceToSecondTopicParam}`));
      }
      if (consumerModeAll || consumerModeEachMessage) {
        allPromises.push(runCommand(`MODE=${mode} INITIAL_DELAY_MS=${INITIAL_DELAY_MS} TERMINATE_TIMEOUT_MS=${TERMINATE_TIMEOUT_MS_LAG_MONITORING} GROUPID_MONITOR=${groupIdEachMessage} node performance-consolidated.js --monitor-lag`));
      }
      if (consumerModeAll || consumerModeEachBatch) {
        allPromises.push(runCommand(`MODE=${mode} INITIAL_DELAY_MS=${INITIAL_DELAY_MS} TERMINATE_TIMEOUT_MS=${TERMINATE_TIMEOUT_MS_LAG_MONITORING} GROUPID_MONITOR=${groupIdEachBatch} node performance-consolidated.js --monitor-lag`));
      }
      const results = await Promise.allSettled(allPromises);
      return ret.concat(results.map(r => r.status === 'fulfilled' ? r.value : '')).join('\n');
    } else {
      console.log(`Running ${modeLabel} Producer/Consumer test...`);
      return runCommand(`MODE=${mode} MESSAGE_COUNT=${messageCount} GROUPID_MESSAGE=${groupIdEachMessage} GROUPID_BATCH=${groupIdEachBatch} node performance-consolidated.js --create-topics ${consumerParam} ${produceToSecondTopicParam} --producer`);
    }
  }

  const runProducerConsumer = async () => {
    console.log(`Running Producer/Consumer tests with Confluent Kafka JS at ${new Date().toISOString()}`);
    outputConfluentProducerConsumer = await runProducerConsumerMode('confluent');
    console.log(`Running Producer/Consumer tests with KafkaJS at ${new Date().toISOString()}`);
    outputKjsProducerConsumer = await runProducerConsumerMode('kafkajs');
    console.log(`Producer/Consumer tests completed at ${new Date().toISOString()}`);
  }

  await runProducerConsumer();
  console.log(outputConfluentProducerConsumer);
  console.log(outputKjsProducerConsumer);

  console.log('Running Confluent CTP test...');
  const outputConfluentCtp = skipCtpTest ? '' :
    (await runCommand('MODE=confluent MESSAGE_COUNT=5000 node performance-consolidated.js --create-topics --ctp'));

  console.log('Running KafkaJS CTP test...');
  const outputKjsCtp = skipCtpTest ? '' :
    (await runCommand('MODE=kafkajs MESSAGE_COUNT=5000 node performance-consolidated.js --create-topics --ctp'));

  // Extract Confluent results
  let ctpConfluent, ctpKjs;
  let consumerConfluentMessage;
  let consumerConfluentMessageRate;
  let consumerConfluentMessageAvgLatencyT0T1;
  let consumerConfluentMessageMaxLatencyT0T1;
  let consumerConfluentMessageAvgLatencyT0T2;
  let consumerConfluentMessageMaxLatencyT0T2;
  let consumerConfluentTime;
  let consumerConfluentMessageAverageRSS;
  let consumerConfluentMessageMaxRSS;
  let consumerConfluentMessageAverageBrokerLag;
  let consumerConfluentMessageMaxBrokerLag;
  let consumerConfluentMessageTotalLagMeasurements;

  let consumerConfluentBatch;
  let consumerConfluentBatchRate;
  let consumerConfluentBatchAvgLatencyT0T1;
  let consumerConfluentBatchMaxLatencyT0T1;
  let consumerConfluentBatchAvgLatencyT0T2;
  let consumerConfluentBatchMaxLatencyT0T2;
  let consumerConfluentBatchTime;
  let consumerConfluentBatchAverageLag;
  let consumerConfluentBatchMaxLag;
  let consumerConfluentBatchAverageSize;
  let consumerConfluentBatchAverageRSS;
  let consumerConfluentBatchMaxRSS;
  let consumerConfluentBatchAverageBrokerLag;
  let consumerConfluentBatchMaxBrokerLag;
  let consumerConfluentBatchTotalLagMeasurements;

  const producerConfluent = extractValue(outputConfluentProducerConsumer, '=== Producer Rate:');
  const producerConfluentAverageRSS = extractValue(outputConfluentProducerConsumer, '=== Average producer RSS KB:');
  const producerConfluentMaxRSS = extractValue(outputConfluentProducerConsumer, '=== Max producer RSS KB:');
  if (consumerModeAll || consumerModeEachMessage) {
    consumerConfluentMessage = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate MB/s (eachMessage):');
    consumerConfluentMessageRate = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate msg/s (eachMessage):');
    consumerConfluentMessageAvgLatencyT0T1 = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency T0-T1 (eachMessage):');
    consumerConfluentMessageMaxLatencyT0T1 = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency T0-T1 (eachMessage):');
    consumerConfluentMessageAvgLatencyT0T2 = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency T0-T2 (eachMessage):');
    consumerConfluentMessageMaxLatencyT0T2 = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency T0-T2 (eachMessage):');
    consumerConfluentTime = extractValue(outputConfluentProducerConsumer, '=== Consumption time (eachMessage):');
    consumerConfluentMessageAverageRSS = extractValue(outputConfluentProducerConsumer, '=== Average consumer-each-message RSS KB:');
    consumerConfluentMessageMaxRSS = extractValue(outputConfluentProducerConsumer, '=== Max consumer-each-message RSS KB:');
    consumerConfluentMessageAverageBrokerLag = extractValue(outputConfluentProducerConsumer, `=== Average broker lag (${groupIdEachMessageConfluent}):`);
    consumerConfluentMessageMaxBrokerLag = extractValue(outputConfluentProducerConsumer, `=== Max broker lag (${groupIdEachMessageConfluent}):`);
    consumerConfluentMessageTotalLagMeasurements = extractValue(outputConfluentProducerConsumer, `=== Sample size for broker lag measurement (${groupIdEachMessageConfluent}):`);
  }
  if (consumerModeAll || consumerModeEachBatch) {
    consumerConfluentBatch = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate MB/s (eachBatch):');
    consumerConfluentBatchRate = extractValue(outputConfluentProducerConsumer, '=== Consumer Rate msg/s (eachBatch):');
    consumerConfluentBatchAvgLatencyT0T1 = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency T0-T1 (eachBatch):');
    consumerConfluentBatchMaxLatencyT0T1 = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency T0-T1 (eachBatch):');
    consumerConfluentBatchAvgLatencyT0T2 = extractValue(outputConfluentProducerConsumer, '=== Consumer average E2E latency T0-T2 (eachBatch):');
    consumerConfluentBatchMaxLatencyT0T2 = extractValue(outputConfluentProducerConsumer, '=== Consumer max E2E latency T0-T2 (eachBatch):');
    consumerConfluentBatchTime = extractValue(outputConfluentProducerConsumer, '=== Consumption time (eachBatch):');
    consumerConfluentBatchAverageLag = extractValue(outputConfluentProducerConsumer, '=== Average eachBatch lag:');
    consumerConfluentBatchMaxLag = extractValue(outputConfluentProducerConsumer, '=== Max eachBatch lag:');
    consumerConfluentBatchAverageSize = extractValue(outputConfluentProducerConsumer, '=== Average eachBatch size:');
    consumerConfluentBatchAverageRSS = extractValue(outputConfluentProducerConsumer, '=== Average consumer-each-batch RSS KB:');
    consumerConfluentBatchMaxRSS = extractValue(outputConfluentProducerConsumer, '=== Max consumer-each-batch RSS KB:');
    consumerConfluentBatchAverageBrokerLag = extractValue(outputConfluentProducerConsumer, `=== Average broker lag (${groupIdEachBatchConfluent}):`);
    consumerConfluentBatchMaxBrokerLag = extractValue(outputConfluentProducerConsumer, `=== Max broker lag (${groupIdEachBatchConfluent}):`);
    consumerConfluentBatchTotalLagMeasurements = extractValue(outputConfluentProducerConsumer, `=== Sample size for broker lag measurement (${groupIdEachBatchConfluent}):`);
  }
  const consumerConfluentAverageRSS = extractValue(outputConfluentProducerConsumer, '=== Max Average RSS across tests:');
  const consumerConfluentMaxRSS = extractValue(outputConfluentProducerConsumer, '=== Max RSS across tests:');
  if (!skipCtpTest) {
    ctpConfluent = extractValue(outputConfluentCtp, '=== Consume-Transform-Produce Rate:');
  }

  // Extract KafkaJS results
  let consumerKjsMessage;
  let consumerKjsMessageRate;
  let consumerKjsMessageAvgLatencyT0T1;
  let consumerKjsMessageMaxLatencyT0T1;
  let consumerKjsTime;
  let consumerKjsMessageAverageRSS;
  let consumerKjsMessageMaxRSS;
  let consumerKjsMessageAverageBrokerLag;
  let consumerKjsMessageMaxBrokerLag;
  let consumerKjsMessageTotalLagMeasurements;

  let consumerKjsBatch;
  let consumerKjsBatchRate;
  let consumerKjsBatchAvgLatencyT0T1;
  let consumerKjsBatchMaxLatencyT0T1;
  let consumerKjsBatchTime;
  let consumerKjsBatchAverageLag;
  let consumerKjsBatchMaxLag;
  let consumerKjsBatchAverageSize;
  let consumerKjsBatchAverageRSS;
  let consumerKjsBatchMaxRSS;
  let consumerKjsBatchAverageBrokerLag;
  let consumerKjsBatchMaxBrokerLag;
  let consumerKjsBatchTotalLagMeasurements;

  const producerKjs = extractValue(outputKjsProducerConsumer, '=== Producer Rate:');
  const producerKjsAverageRSS = extractValue(outputKjsProducerConsumer, '=== Average producer RSS KB:');
  const producerKjsMaxRSS = extractValue(outputKjsProducerConsumer, '=== Max producer RSS KB:');
  if (consumerModeAll || consumerModeEachMessage) {
    consumerKjsMessage = extractValue(outputKjsProducerConsumer, '=== Consumer Rate MB/s (eachMessage):');
    consumerKjsMessageRate = extractValue(outputKjsProducerConsumer, '=== Consumer Rate msg/s (eachMessage):');
    consumerKjsMessageAvgLatencyT0T1 = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency T0-T1 (eachMessage):');
    consumerKjsMessageMaxLatencyT0T1 = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency T0-T1 (eachMessage):');
    consumerKjsMessageAvgLatencyT0T2 = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency T0-T2 (eachMessage):');
    consumerKjsMessageMaxLatencyT0T2 = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency T0-T2 (eachMessage):');
    consumerKjsTime = extractValue(outputKjsProducerConsumer, '=== Consumption time (eachMessage):');
    consumerKjsMessageAverageRSS = extractValue(outputKjsProducerConsumer, '=== Average consumer-each-message RSS KB:');
    consumerKjsMessageMaxRSS = extractValue(outputKjsProducerConsumer, '=== Max consumer-each-message RSS KB:');
    consumerKjsMessageAverageBrokerLag = extractValue(outputKjsProducerConsumer, `=== Average broker lag (${groupIdEachMessageKafkaJS}):`);
    consumerKjsMessageMaxBrokerLag = extractValue(outputKjsProducerConsumer, `=== Max broker lag (${groupIdEachMessageKafkaJS}):`);
    consumerKjsMessageTotalLagMeasurements = extractValue(outputKjsProducerConsumer, `=== Sample size for broker lag measurement (${groupIdEachMessageKafkaJS}):`);
  }
  if (consumerModeAll || consumerModeEachBatch) {
    consumerKjsBatch = extractValue(outputKjsProducerConsumer, '=== Consumer Rate MB/s (eachBatch):');
    consumerKjsBatchRate = extractValue(outputKjsProducerConsumer, '=== Consumer Rate msg/s (eachBatch):');
    consumerKjsBatchAvgLatencyT0T1 = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency T0-T1 (eachBatch):');
    consumerKjsBatchMaxLatencyT0T1 = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency T0-T1 (eachBatch):');
    consumerKjsBatchAvgLatencyT0T2 = extractValue(outputKjsProducerConsumer, '=== Consumer average E2E latency T0-T2 (eachBatch):');
    consumerKjsBatchMaxLatencyT0T2 = extractValue(outputKjsProducerConsumer, '=== Consumer max E2E latency T0-T2 (eachBatch):');
    consumerKjsBatchTime = extractValue(outputKjsProducerConsumer, '=== Consumption time (eachBatch):');
    consumerKjsBatchAverageLag = extractValue(outputKjsProducerConsumer, '=== Average eachBatch lag:');
    consumerKjsBatchMaxLag = extractValue(outputKjsProducerConsumer, '=== Max eachBatch lag:');
    consumerKjsBatchAverageSize = extractValue(outputKjsProducerConsumer, '=== Average eachBatch size:');
    consumerKjsBatchAverageRSS = extractValue(outputKjsProducerConsumer, '=== Average consumer-each-batch RSS KB:');
    consumerKjsBatchMaxRSS = extractValue(outputKjsProducerConsumer, '=== Max consumer-each-batch RSS KB:');
    consumerKjsBatchAverageBrokerLag = extractValue(outputKjsProducerConsumer, `=== Average broker lag (${groupIdEachBatchKafkaJS}):`);
    consumerKjsBatchMaxBrokerLag = extractValue(outputKjsProducerConsumer, `=== Max broker lag (${groupIdEachBatchKafkaJS}):`);
    consumerKjsBatchTotalLagMeasurements = extractValue(outputKjsProducerConsumer, `=== Sample size for broker lag measurement (${groupIdEachBatchKafkaJS}):`);
  }
  const consumerKjsAverageRSS = extractValue(outputKjsProducerConsumer, '=== Max Average RSS across tests:');
  const consumerKjsMaxRSS = extractValue(outputKjsProducerConsumer, '=== Max RSS across tests:');
  if (!skipCtpTest) {
    ctpKjs = extractValue(outputKjsCtp, '=== Consume-Transform-Produce Rate:');
  }

  // Print results
  console.log(`Producer rates: confluent ${producerConfluent}, kafkajs ${producerKjs}`);
  console.log(`Average RSS (produce): confluent ${producerConfluentAverageRSS}, kafkajs ${producerKjsAverageRSS}`);
  console.log(`Max RSS (produce): confluent ${producerConfluentMaxRSS}, kafkajs ${producerKjsMaxRSS}`);
  if (consumerModeAll || consumerModeEachMessage) {
    console.log(`Consumer rates MB/s (eachMessage): confluent ${consumerConfluentMessage}, kafkajs ${consumerKjsMessage}`);
    console.log(`Consumer rates msg/s (eachMessage): confluent ${consumerConfluentMessageRate}, kafkajs ${consumerKjsMessageRate}`);
    console.log(`Consumption time (eachMessage): confluent ${consumerConfluentTime}, kafkajs ${consumerKjsTime}`);
    console.log(`Average RSS (eachMessage): confluent ${consumerConfluentMessageAverageRSS}, kafkajs ${consumerKjsMessageAverageRSS}`);
    console.log(`Max RSS (eachMessage): confluent ${consumerConfluentMessageMaxRSS}, kafkajs ${consumerKjsMessageMaxRSS}`);
    if (concurrentRun) {
      console.log(`Consumer average E2E latency T0-T1 (eachMessage): confluent ${consumerConfluentMessageAvgLatencyT0T1}, kafkajs ${consumerKjsMessageAvgLatencyT0T1}`);
      console.log(`Consumer max E2E latency T0-T1 (eachMessage): confluent ${consumerConfluentMessageMaxLatencyT0T1}, kafkajs ${consumerKjsMessageMaxLatencyT0T1}`);
      if (produceToSecondTopic) {
        console.log(`Consumer average E2E latency T0-T2 (eachMessage): confluent ${consumerConfluentMessageAvgLatencyT0T2}, kafkajs ${consumerKjsMessageAvgLatencyT0T2}`);
        console.log(`Consumer max E2E latency T0-T2 (eachMessage): confluent ${consumerConfluentMessageMaxLatencyT0T2}, kafkajs ${consumerKjsMessageMaxLatencyT0T2}`);
      }
      console.log(`Average broker lag (eachMessage): confluent ${consumerConfluentMessageAverageBrokerLag}, kafkajs ${consumerKjsMessageAverageBrokerLag}`);
      console.log(`Max broker lag (eachMessage): confluent ${consumerConfluentMessageMaxBrokerLag}, kafkajs ${consumerKjsMessageMaxBrokerLag}`);
      console.log(`Sample size for broker lag measurement (eachMessage): confluent ${consumerConfluentMessageTotalLagMeasurements}, kafkajs ${consumerKjsMessageTotalLagMeasurements}`);
    }
  }
  if (consumerModeAll || consumerModeEachBatch) {
    console.log(`Consumer rates MB/s (eachBatch): confluent ${consumerConfluentBatch}, kafkajs ${consumerKjsBatch}`);
    console.log(`Consumer rates msg/s (eachBatch): confluent ${consumerConfluentBatchRate}, kafkajs ${consumerKjsBatchRate}`);
    console.log(`Consumption time (eachBatch): confluent ${consumerConfluentBatchTime}, kafkajs ${consumerKjsBatchTime}`);
    console.log(`Average eachBatch size: confluent ${consumerConfluentBatchAverageSize}, kafkajs ${consumerKjsBatchAverageSize}`);
    console.log(`Average RSS (eachBatch): confluent ${consumerConfluentBatchAverageRSS}, kafkajs ${consumerKjsBatchAverageRSS}`);
    console.log(`Max RSS (eachBatch): confluent ${consumerConfluentBatchMaxRSS}, kafkajs ${consumerKjsBatchMaxRSS}`);
    if (concurrentRun) {
      console.log(`Consumer average E2E latency T0-T1 (eachBatch): confluent ${consumerConfluentBatchAvgLatencyT0T1}, kafkajs ${consumerKjsBatchAvgLatencyT0T1}`);
      console.log(`Consumer max E2E latency T0-T1 (eachBatch): confluent ${consumerConfluentBatchMaxLatencyT0T1}, kafkajs ${consumerKjsBatchMaxLatencyT0T1}`);
      if (produceToSecondTopic) {
        console.log(`Consumer average E2E latency T0-T2 (eachBatch): confluent ${consumerConfluentBatchAvgLatencyT0T2}, kafkajs ${consumerKjsBatchAvgLatencyT0T2}`);
        console.log(`Consumer max E2E latency T0-T2 (eachBatch): confluent ${consumerConfluentBatchMaxLatencyT0T2}, kafkajs ${consumerKjsBatchMaxLatencyT0T2}`);
      }
      console.log(`Average eachBatch lag: confluent ${consumerConfluentBatchAverageLag}, kafkajs ${consumerKjsBatchAverageLag}`);
      console.log(`Max eachBatch lag: confluent ${consumerConfluentBatchMaxLag}, kafkajs ${consumerKjsBatchMaxLag}`);
      console.log(`Average broker lag (eachBatch): confluent ${consumerConfluentBatchAverageBrokerLag}, kafkajs ${consumerKjsBatchAverageBrokerLag}`);
      console.log(`Max broker lag (eachBatch): confluent ${consumerConfluentBatchMaxBrokerLag}, kafkajs ${consumerKjsBatchMaxBrokerLag}`);
      console.log(`Sample size for broker lag measurement (eachBatch): confluent ${consumerConfluentBatchTotalLagMeasurements}, kafkajs ${consumerKjsBatchTotalLagMeasurements}`);
    }
  }
  if (!concurrentRun) {
    console.log(`Average RSS: confluent ${consumerConfluentAverageRSS}, kafkajs ${consumerKjsAverageRSS}`);
    console.log(`Max RSS: confluent ${consumerConfluentMaxRSS}, kafkajs ${consumerKjsMaxRSS}`);
  }
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