// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

async function fetchOffsets() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node fetchOffsets.js <group_id> [topic [partition ...] ...]");
    process.exit(1);
  }

  const [groupId, ...rest] = args;

  const kafka = new Kafka({
    kafkaJS: {
      brokers: ["localhost:9092"],
    },
  });

  const admin = kafka.admin();
  await admin.connect();

  try {
    // Parse topics and partitions from remaining arguments
    const topicInput = parseTopicsAndPartitions(rest);

    // Fetch offsets for the specified consumer group
    const offsets = await admin.fetchOffsets({
      groupId: groupId,
      topics: topicInput,
    });

    console.log(`Offsets for Consumer Group "${groupId}":`, JSON.stringify(offsets, null, 2));
  } catch (err) {
    console.error("Error fetching consumer group offsets:", err);
  } finally {
    await admin.disconnect();
  }
}

// Helper function to parse topics and partitions from arguments
function parseTopicsAndPartitions(args) {
  if (args.length === 0) return undefined;

  const topicInput = [];
  let i = 0;

  while (i < args.length) {
    const topic = args[i];
    i++;

    const partitions = [];
    while (i < args.length && !isNaN(args[i])) {
      partitions.push(Number(args[i]));
      i++;
    }

    // Add topic with partitions (or an empty array if no partitions specified)
    if (partitions.length > 0) {
      topicInput.push({ topic, partitions });
    } else {
      topicInput.push(topic); // Add as a string if no partitions specified
    }
  }

  return topicInput;
}

fetchOffsets();
