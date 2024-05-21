jest.setTimeout(30000);

const { ErrorCodes } = require("../../../lib").KafkaJS;
const {
  secureRandom,
  createTopic,
  createProducer,
  createConsumer,
  waitForMessages,
  createAdmin,
} = require("../testhelpers");

describe("fetchOffset function", () => {
  let topicName, groupId, producer, consumer, admin;

  beforeEach(async () => {
    topicName = `test-topic-${secureRandom()}`;
    groupId = `consumer-group-id-${secureRandom()}`;

    producer = createProducer({
      clientId: "test-producer-id",
    });

    consumer = createConsumer({
      groupId,
      fromBeginning: true,
      clientId: "test-consumer-id",
    });

    await createTopic({ topic: topicName, partitions: 1 });

    admin = createAdmin({});
  });

  afterEach(async () => {
    producer && (await producer.disconnect());
    consumer && (await consumer.disconnect());
  });

  it("should timeout when fetching offsets", async () => {
    await admin.connect();

    await expect(
      admin.fetchOffsets({ groupId, topic: topicName, timeout: 0 })
    ).rejects.toHaveProperty("code", ErrorCodes.ERR__TIMED_OUT);
  });

  test("should return correct offset after consuming messages", async () => {
    await producer.connect();
    await consumer.connect();

    await admin.connect();

    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    await consumer.subscribe({ topic: topicName });

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

    // Fetch offsets after all messages have been consumed
    const offsets = await admin.fetchOffsets({
      groupId: groupId,
      topics: [topicName],
    });

    const result = offsets;
    expect(messagesConsumed.length).toEqual(5);
    expect(result).toEqual([
      { topic: topicName, partitions: { partition: 0, offset: 4 } },
    ]);

    await admin.disconnect(); // Disconnect the admin client
  });

  test("should return correct offset after consuming messages with specific partitions", async () => {
    await producer.connect();
    await consumer.connect();

    await admin.connect();

    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    await consumer.subscribe({ topic: topicName });

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

    // Fetch offsets after all messages have been consumed
    const offsets = await admin.fetchOffsets({
      groupId,
      topics: [{ topic: topicName, partitions: [0] }],
    });

    const result = offsets;
    expect(messagesConsumed.length).toEqual(5);
    expect(result).toEqual([
      { topic: topicName, partitions: { partition: 0, offset: 4 } },
    ]);

    await admin.disconnect(); // Disconnect the admin client
  });
});
