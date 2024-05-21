// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

let producer, consumer, admin;
let Id = "newGroup";
let topicName = "newTopic";

const kafka = new Kafka({
  kafkaJS: {
    brokers: ["localhost:9092"],
  },
});

async function waitFor(check, resolveValue, { delay = 50 } = {}) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
        resolve(resolveValue());
      }
    }, delay);
  });
}

async function waitForMessages(messagesConsumed, { number = 1, delay } = {}) {
  return waitFor(
    () => messagesConsumed.length >= number,
    () => messagesConsumed,
    { delay }
  );
}

async function adminStart() {
  admin = kafka.admin();
  await admin.connect();

  producer = kafka.producer();
  consumer = kafka.consumer({
    kafkaJS: {
      groupId: Id,
      fromBeginning: true,
    },
  });

  await admin.createTopics({
    topics: [{ topic: topicName, numPartitions: 1 }],
  });
  console.log("Topic created successfully");

  await producer.connect();
  await consumer.connect();

  console.log("Consumer Connected successfully");

  await consumer.subscribe({
    topics: [topicName],
  });
  console.log("Consumer subscribed to topic");

  const messages = Array.from({ length: 5 }, (_, i) => ({
    value: `message${i}`,
  }));

  await producer.send({ topic: topicName, messages });
  console.log("Messages sent till offset 4");

  let messagesConsumed = []; // Define messagesConsumed

  await consumer.run({
    eachMessage: async (message) => {
      messagesConsumed.push(message); // Populate messagesConsumed
      if (messagesConsumed.length === 5) {
        await consumer.stop();
      }
    },
  });

  await waitForMessages(messagesConsumed, { number: 5 });
  console.log("Messages consumed successfully");
  await producer.disconnect();
  await consumer.disconnect();
  // Fetch offsets after all messages have been consumed
  const offsets = await admin.fetchOffsets({
    groupId: Id,
    topics: [topicName],
  });

  console.log("Consumer group offsets: ", offsets);

  await admin.deleteGroups([Id]);
  console.log("Consumer group deleted successfully");
  await admin.deleteTopics({
    topics: [topicName],
  });

  await admin.disconnect();
}

adminStart();
