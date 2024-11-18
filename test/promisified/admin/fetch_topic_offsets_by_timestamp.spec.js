jest.setTimeout(30000);

const { ErrorCodes } = require("../../../lib").KafkaJS;
const {
  secureRandom,
  createTopic,
  createProducer,
  createAdmin,
} = require("../testhelpers");

describe("fetchTopicOffsetsByTimestamp function", () => {
  let topicName, admin, producer;

  beforeEach(async () => {
    admin = createAdmin({});
    producer = createProducer({
      clientId: "test-producer-id",
    });

    await admin.connect();
    await producer.connect();

    topicName = `test-topic-${secureRandom()}`;
  });

  afterEach(async () => {
    await admin.deleteTopics({
      topics: [topicName],
    });
    await admin.disconnect();
    producer && (await producer.disconnect());
  });

  it("should timeout when fetching topic offsets by timestamp", async () => {
    await createTopic({ topic: topicName, partitions: 1 });

    await expect(
      admin.fetchTopicOffsetsByTimestamp(topicName, Date.now(), { timeout: 0 })
    ).rejects.toHaveProperty("code", ErrorCodes.ERR__TIMED_OUT);
  });

  it("should return result for a topic with a single partition and timestamp provided", async () => {
    await createTopic({ topic: topicName, partitions: 1 });

    // Send some messages to reach specific offsets
    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    const timestamp = Date.now();

    // Fetch offsets with timestamp
    const offsets = await admin.fetchTopicOffsetsByTimestamp(topicName, timestamp);

    expect(offsets).toEqual([
      {
        partition: 0,
        offset: "0", // As per the test case, the timestamp should return offset '0'
      },
    ]);
  });

  it("should return result for a topic with a single partition and no timestamp", async () => {
    await createTopic({ topic: topicName, partitions: 1 });

    // Send some messages to reach specific offsets
    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    // Fetch offsets without providing timestamp
    const offsets = await admin.fetchTopicOffsetsByTimestamp(topicName);

    expect(offsets).toEqual([
      {
        partition: 0,
        offset: "5", // As per the test case, no timestamp should return the last committed offset '5'
      },
    ]);
  });

  it("should return result for a topic with multiple partitions and timestamp provided", async () => {
    await createTopic({ topic: topicName, partitions: 2 });

    const messagesPartition0 = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
      partition: 0,
    }));
    const messagesPartition1 = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
      partition: 1,
    }));

    await producer.send({ topic: topicName, messages: messagesPartition0 });
    await producer.send({ topic: topicName, messages: messagesPartition1 });

    const timestamp = Date.now();

    // Fetch offsets with timestamp
    const offsets = await admin.fetchTopicOffsetsByTimestamp(topicName, timestamp);

    expect(offsets).toEqual([
      {
        partition: 0,
        offset: "0", // As per the test case, timestamp should return offset '0' for partition 0
      },
      {
        partition: 1,
        offset: "0", // As per the test case, timestamp should return offset '0' for partition 1
      },
    ]);
  });

  it("should return result for a topic with multiple partitions and no timestamp", async () => {
    await createTopic({ topic: topicName, partitions: 2 });

    const messagesPartition0 = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
      partition: 0,
    }));
    const messagesPartition1 = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
      partition: 1,
    }));

    await producer.send({ topic: topicName, messages: messagesPartition0 });
    await producer.send({ topic: topicName, messages: messagesPartition1 });

    // Fetch offsets without providing timestamp
    const offsets = await admin.fetchTopicOffsetsByTimestamp(topicName);

    expect(offsets).toEqual([
      {
        partition: 0,
        offset: "5", // As per the test case, no timestamp should return the last committed offset '5'
      },
      {
        partition: 1,
        offset: "5", // As per the test case, no timestamp should return the last committed offset '5'
      },
    ]);
  });
});
