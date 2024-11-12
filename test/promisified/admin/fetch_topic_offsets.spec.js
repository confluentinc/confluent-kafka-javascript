// timeout
// should return result for a topic with single partition
// should return result for a topic with multiple partitions

jest.setTimeout(30000);

const { ErrorCodes, IsolationLevel } = require("../../../lib").KafkaJS;
const {
  secureRandom,
  createTopic,
  createProducer,
  createConsumer,
  waitForMessages,
  createAdmin,
} = require("../testhelpers");

describe("fetchTopicOffsets function", () => {
  let topicName, admin, producer, consumer;
  let topicsToDelete = [];

  beforeEach(async () => {
    admin = createAdmin({});
    producer = createProducer({
      clientId: "test-producer-id",
    });
    consumer = createConsumer({
      groupId: `consumer-group-id-${secureRandom()}`,
      fromBeginning: true,
      clientId: "test-consumer-id",
      autoCommit: false,
    });

    await admin.connect();
    await producer.connect();
    await consumer.connect();

    topicName = `test-topic-${secureRandom()}`;
    topicsToDelete = [];
  });

  afterEach(async () => {
    await admin.deleteTopics({
      topics: topicsToDelete,
    });
    await admin.disconnect();
    producer && (await producer.disconnect());
    consumer && (await consumer.disconnect());
  });

  it("should timeout when fetching topic offsets", async () => {
    await createTopic({ topic: topicName, partitions: 1 });
    topicsToDelete.push(topicName);

    await expect(
      admin.fetchTopicOffsets(topicName, { timeout: 0 })
    ).rejects.toHaveProperty("code", ErrorCodes.ERR__TIMED_OUT);
  });

  it("should return result for a topic with a single partition with isolation level READ_UNCOMMITTED", async () => {
    await createTopic({ topic: topicName, partitions: 1 });
    topicsToDelete.push(topicName);

    // Send some messages to reach specific offsets
    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    // Fetch offsets with isolation level READ_UNCOMMITTED
    const offsets = await admin.fetchTopicOffsets(topicName, {
      isolationLevel: IsolationLevel.READ_UNCOMMITTED,
    });

    expect(offsets).toEqual([
      {
        partition: 0,
        offset: "4",
        low: "0",
        high: "5",
      },
    ]);
  });

  it("should return result for a topic with a single partition with isolation level READ_COMMITTED", async () => {
    await createTopic({ topic: topicName, partitions: 1 });
    topicsToDelete.push(topicName);

    // Send some messages to reach specific offsets
    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    // Consume and commit messages to simulate committed data
    let messagesConsumed = [];
    await consumer.subscribe({ topic: topicName });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messagesConsumed.push(message);
        if (parseInt(message.offset, 10) === 4) {
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (parseInt(message.offset, 10) + 1).toString(),
              },
            ]);
          }
      },
    });

    await waitForMessages(messagesConsumed, { number: 5 });

    // Fetch offsets with isolation level READ_COMMITTED
    const offsets = await admin.fetchTopicOffsets(topicName, {
      isolationLevel: IsolationLevel.READ_COMMITTED,
    });

    expect(offsets).toEqual([
      {
        partition: 0,
        offset: "4",
        low: "0",
        high: "5",
      },
    ]);
  });

  it("should return result for a topic with multiple partitions with isolation level READ_UNCOMMITTED", async () => {
    await createTopic({ topic: topicName, partitions: 2 });
    topicsToDelete.push(topicName);

    const messagesPartition0 = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
      partition: 0,
    }));
    const messagesPartition1 = Array.from({ length: 10 }, (_, i) => ({
      value: `message${i}`,
      partition: 1,
    }));

    await producer.send({ topic: topicName, messages: messagesPartition0 });
    await producer.send({ topic: topicName, messages: messagesPartition1 });

    // Fetch offsets with isolation level READ_UNCOMMITTED
    const offsets = await admin.fetchTopicOffsets(topicName, {
      isolationLevel: IsolationLevel.READ_UNCOMMITTED,
    });

    expect(offsets).toEqual([
      { partition: 0, offset: "4", low: "0", high: "5" },
      { partition: 1, offset: "4", low: "0", high: "5" },
    ]);
  });

  it("should return result for a topic with multiple partitions with isolation level READ_COMMITTED", async () => {
    await createTopic({ topic: topicName, partitions: 2 });
    topicsToDelete.push(topicName);

    const messagesPartition0 = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
      partition: 0,
    }));
    const messagesPartition1 = Array.from({ length: 10 }, (_, i) => ({
      value: `message${i}`,
      partition: 1,
    }));

    await producer.send({ topic: topicName, messages: messagesPartition0 });
    await producer.send({ topic: topicName, messages: messagesPartition1 });

    // Consume and commit messages to simulate committed data for both partitions
    let messagesConsumed = [];
    await consumer.subscribe({ topic: topicName });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messagesConsumed.push(message);

        if (parseInt(message.offset, 10) === 4) {
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (parseInt(message.offset, 10) + 1).toString(),
              },
            ]);
          }
      },
    });

    await waitForMessages(messagesConsumed, { number: 10 });

    // Fetch offsets with isolation level READ_COMMITTED
    const offsets = await admin.fetchTopicOffsets(topicName, {
      isolationLevel: IsolationLevel.READ_COMMITTED,
    });

    expect(offsets).toEqual([
      { partition: 0, offset: "4", low: "0", high: "5" },
      { partition: 1, offset: "4", low: "0", high: "5" },
    ]);
  });
});
