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
  let topicName, topicName2, groupId, producer, consumer, admin;

  beforeEach(async () => {
    groupId = `consumer-group-id-${secureRandom()}`;

    producer = createProducer({
      clientId: "test-producer-id",
    });

    consumer = createConsumer({
      groupId,
      fromBeginning: true,
      clientId: "test-consumer-id",
      autoCommit: false,
    });

    admin = createAdmin({});
  });

  afterEach(async () => {
    producer && (await producer.disconnect());
    consumer && (await consumer.disconnect());
  });

  test("should timeout when fetching offsets", async () => {
    await admin.connect();

    topicName = `test-topic-${secureRandom()}`;

    await createTopic({ topic: topicName, partitions: 1 });

    await expect(
      admin.fetchOffsets({ groupId, topic: topicName, timeout: 0 })
    ).rejects.toHaveProperty("code", ErrorCodes.ERR__TIMED_OUT);

    await admin.deleteTopics({
      topics: [topicName],
    });

    await admin.deleteGroups([groupId]);
  });

  test("should return correct offset after consuming messages", async () => {
    await producer.connect();
    await consumer.connect();

    await admin.connect();

    topicName = `test-topic-${secureRandom()}`;

    await createTopic({ topic: topicName, partitions: 1 });

    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    await consumer.subscribe({ topic: topicName });

    let messagesConsumed = []; // Define messagesConsumed

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          messagesConsumed.push(message); // Populate messagesConsumed
          if (messagesConsumed.length === 5) {
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (parseInt(message.offset, 10) + 1).toString(),
              },
            ]);
            await consumer.stop();
          }
        } catch (error) {
          if (error.message.includes("Offset out of range")) {
            await consumer.stop();
          } else {
            throw error; // Re-throw the error if it's not an "Offset out of range" error
          }
        }
      },
    });

    await waitForMessages(messagesConsumed, { number: 5 });

    // Fetch offsets after all messages have been consumed
    const offsets = await admin.fetchOffsets({
      groupId: groupId,
      topics: [topicName],
    });
    expect(messagesConsumed.length).toEqual(5);

    const resultWithoutLeaderEpoch = offsets.map(({ partitions, ...rest }) => {
      const newPartitions = partitions.map(
        ({ leaderEpoch, ...restPartitions }) => restPartitions
      );
      return { ...rest, partitions: newPartitions };
    });

    expect(resultWithoutLeaderEpoch).toEqual([
      {
        topic: topicName,
        partitions: [{ partition: 0, offset: 5 }],
      },
    ]);

    await admin.deleteTopics({
      topics: [topicName],
    });

    await admin.deleteGroups([groupId]);

    await admin.disconnect(); // Disconnect the admin client
  });

  test("should return correct offset after consuming messages with specific partitions", async () => {
    await producer.connect();
    await consumer.connect();

    await admin.connect();

    topicName = `test-topic-${secureRandom()}`;

    await createTopic({ topic: topicName, partitions: 1 });

    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    await consumer.subscribe({ topic: topicName });

    let messagesConsumed = []; // Define messagesConsumed

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          messagesConsumed.push(message); // Populate messagesConsumed
          if (messagesConsumed.length === 5) {
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (parseInt(message.offset, 10) + 1).toString(),
              },
            ]);
            await consumer.stop();
          }
        } catch (error) {
          if (error.message.includes("Offset out of range")) {
            await consumer.stop();
          } else {
            throw error; // Re-throw the error if it's not an "Offset out of range" error
          }
        }
      },
    });

    await waitForMessages(messagesConsumed, { number: 5 });

    // Fetch offsets after all messages have been consumed
    const offsets = await admin.fetchOffsets({
      groupId,
      topics: [{ topic: topicName, partitions: [0] }],
    });

    const resultWithoutLeaderEpoch = offsets.map(({ partitions, ...rest }) => {
      const newPartitions = partitions.map(
        ({ leaderEpoch, ...restPartitions }) => restPartitions
      );
      return { ...rest, partitions: newPartitions };
    });

    expect(messagesConsumed.length).toEqual(5);
    expect(resultWithoutLeaderEpoch).toEqual([
      {
        topic: topicName,
        partitions: [{ partition: 0, offset: 5 }],
      },
    ]);

    await admin.deleteTopics({
      topics: [topicName],
    });

    await admin.deleteGroups([groupId]);

    await admin.disconnect(); // Disconnect the admin client
  });

  test("should handle unset or null topics", async () => {
    await producer.connect();
    await consumer.connect();

    await admin.connect();

    topicName = `test-topic-${secureRandom()}`;

    await createTopic({ topic: topicName, partitions: 1 });

    const messages = Array.from({ length: 5 }, (_, i) => ({
      value: `message${i}`,
    }));
    await producer.send({ topic: topicName, messages: messages });

    await consumer.subscribe({ topic: topicName });

    let messagesConsumed = []; // Define messagesConsumed

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          messagesConsumed.push(message); // Populate messagesConsumed
          if (messagesConsumed.length === 5) {
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (parseInt(message.offset, 10) + 1).toString(),
              },
            ]);
            await consumer.stop();
          }
        } catch (error) {
          if (error.message.includes("Offset out of range")) {
            await consumer.stop();
          } else {
            throw error; // Re-throw the error if it's not an "Offset out of range" error
          }
        }
      },
    });

    await waitForMessages(messagesConsumed, { number: 5 });

    // Fetch offsets after all messages have been consumed
    const offsets = await admin.fetchOffsets({
      groupId,
    });

    const resultWithoutLeaderEpoch = offsets.map(({ partitions, ...rest }) => {
      const newPartitions = partitions.map(
        ({ leaderEpoch, ...restPartitions }) => restPartitions
      );
      return { ...rest, partitions: newPartitions };
    });
    expect(messagesConsumed.length).toEqual(5);
    expect(resultWithoutLeaderEpoch).toEqual([
      {
        topic: topicName,
        partitions: [{ partition: 0, offset: 5 }],
      },
    ]);

    const offsets2 = await admin.fetchOffsets({
      groupId,
      topics: null,
    });

    const resultWithoutLeaderEpoch2 = offsets2.map(
      ({ partitions, ...rest }) => {
        const newPartitions = partitions.map(
          ({ leaderEpoch, ...restPartitions }) => restPartitions
        );
        return { ...rest, partitions: newPartitions };
      }
    );
    expect(resultWithoutLeaderEpoch2).toEqual([
      {
        topic: topicName,
        partitions: [{ partition: 0, offset: 5 }],
      },
    ]);

    await admin.deleteTopics({
      topics: [topicName],
    });

    await admin.deleteGroups([groupId]);

    await admin.disconnect(); // Disconnect the admin client  });
  });

  test("should handle multiple topics each with more than 1 partition", async () => {
    await producer.connect();
    await consumer.connect();

    await admin.connect();

    topicName = `test-topic-${secureRandom()}`;
    topicName2 = `test-topic-${secureRandom()}`;

    await createTopic({ topic: topicName, partitions: 2 });
    await createTopic({ topic: topicName2, partitions: 2 });

    await consumer.subscribe({
      topics: [topicName, topicName2],
    });

    const messages = Array.from({ length: 10 }, (_, i) => ({
      value: `message${i}`,
      partition: i % 2, // alternates between 0 and 1 for even and odd i
    }));

    await producer.send({ topic: topicName, messages });
    await producer.send({ topic: topicName2, messages });

    let messagesConsumed = []; // Define messagesConsumed

    let commitCount = 0;

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          messagesConsumed.push(message); // Populate messagesConsumed
          commitCount++;

          if (commitCount === 5) {
            await consumer.commitOffsets([
              {
                topic,
                partition,
                offset: (parseInt(message.offset, 10) + 1).toString(),
              },
            ]);
            commitCount = 0; // Reset the commit count
          }

          if (messagesConsumed.length === 20) {
            await consumer.stop();
          }
        } catch (error) {
          if (error.message.includes("Offset out of range")) {
            await consumer.stop();
          } else {
            throw error; // Re-throw the error if it's not an "Offset out of range" error
          }
        }
      },
    });

    await waitForMessages(messagesConsumed, { number: 20 });

    // Fetch offsets with multiple topics each with more than 1 partition
    const offsets = await admin.fetchOffsets({
      groupId,
    });

    // Sort the actual offsets array
    const sortedOffsets = offsets.sort((a, b) =>
      a.topic.localeCompare(b.topic)
    );

    // remove leaderEpoch from the partitions
    const resultWithoutLeaderEpoch = sortedOffsets.map(
      ({ partitions, ...rest }) => {
        const newPartitions = partitions.map(
          ({ leaderEpoch, ...restPartitions }) => restPartitions
        );
        return { ...rest, partitions: newPartitions };
      }
    );

    expect(resultWithoutLeaderEpoch.length).toEqual(2);

    resultWithoutLeaderEpoch.forEach((item) => {
      expect(item.partitions.length).toEqual(2);
    });

    expect(resultWithoutLeaderEpoch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          topic: topicName,
          partitions: expect.arrayContaining([
            expect.objectContaining({
              partition: 0,
              offset: 5,
            }),
            expect.objectContaining({
              partition: 1,
              offset: 5,
            }),
          ]),
        }),
        expect.objectContaining({
          topic: topicName2,
          partitions: expect.arrayContaining([
            expect.objectContaining({
              partition: 0,
              offset: 5,
            }),
            expect.objectContaining({
              partition: 1,
              offset: 5,
            }),
          ]),
        }),
      ])
    );

    await admin.deleteTopics({
      topics: [topicName, topicName2],
    });

    await admin.deleteGroups([groupId]);

    await admin.disconnect(); // Disconnect the admin client
  });
});
