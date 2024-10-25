// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

const kafka = new Kafka({
  kafkaJS: {
    brokers: ["localhost:9092"],
  },
});

async function producerStart() {
  const producer = kafka.producer();

  await producer.connect();

  console.log("Producer Connected successfully");

  const res = [];
  for (let i = 0; i < 5; i++) {
    res.push(
      producer.send({
        topic: "test-topic",
        messages: [{ value: "v222", partition: 0 }],
      })
    );
  }
  await Promise.all(res);

  await producer.disconnect();

  console.log("Producer Disconnected successfully");
}

async function consumerStart() {
  const consumer = kafka.consumer({
    kafkaJS: {
      groupId: "test-group",
      autoCommit: true,
      rebalanceListener: {
        onPartitionsAssigned: async (assignment) => {
          console.log(`Assigned partitions ${JSON.stringify(assignment)}`);
        },
        onPartitionsRevoked: async (assignment) => {
          console.log(`Revoked partitions ${JSON.stringify(assignment)}`);
        },
      },
    },
  });

  await consumer.connect();
  console.log("Consumer Connected successfully");

  await consumer.subscribe({
    topics: ["test-topic"],
  });

  let counter = 0;
  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (counter < 3) {
        console.log({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          value: message.value.toString(),
        });
        counter++;
      } else {
        await consumer.stop();
      }
    },
  });

  consumer.disconnect().then(() => {
    console.log("Consumer Disconnected successfully");
  }
    );
}

async function adminStart() {
  const admin = kafka.admin();
  await admin.connect();

  await admin
    .createTopics({
      topics: [
        {
          topic: "test-topic",
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    })
    .then(() => {
      console.log("Topic created successfully");
    })
    .catch((err) => {
      console.log("Topic creation failed", err);
    });

  await producerStart();

  await admin
    .fetchOffsets({ groupId: "test-group", topics: [{topic: 'test-topic', partitions: [0]}] })
    .then((res) => {
      console.log("Consumer group offsets: ", res);
    })
    .catch((err) => {
      console.log("Failed to fetch consumer group offsets", err);
    });

  await consumerStart();

  await admin
    .fetchOffsets({ groupId: "test-group", topics: [{topic: 'test-topic', partitions: [0]}] })
    .then((res) => {
      console.log("Consumer group offsets: ", res);
    })
    .catch((err) => {
      console.log("Failed to fetch consumer group offsets", err);
    });

    await admin.disconnect();
}

adminStart();
