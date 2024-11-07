const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;

async function createTopicAndFetchMetadata() {
  const kafka = new Kafka({
    kafkaJS: {
      brokers: ['localhost:9092'],
    },
  });

  const admin = kafka.admin();
  await admin.connect();

  const topicName = 'example-topic';

  try {
    // Create a topic with 2 partitions
    await admin.createTopics({
      topics: [
        {
          topic: topicName,
          numPartitions: 2,
        },
      ],
    });
    console.log(`Topic "${topicName}" created successfully.`);

    // Fetch the topic metadata without including authorized operations
    const metadata = await admin.fetchTopicMetadata({
      topics: [topicName],
      includeAuthorisedOperations: false,
    });

    console.log(`Metadata for topic "${topicName}":`, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await admin.disconnect();
  }
}

createTopicAndFetchMetadata();