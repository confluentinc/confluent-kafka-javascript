// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

let producer, admin;
let topicName = "newTopic";

const kafka = new Kafka({
    kafkaJS: {
        brokers: ["localhost:9092"],
    },
});

async function adminStart() {
    admin = kafka.admin();
    await admin.connect();

    producer = kafka.producer();

    await admin.createTopics({
        topics: [{ topic: topicName, numPartitions: 2 }],
    });
    console.log("Topic created successfully");

    await producer.connect();

    const messagesPartition0 = Array.from({ length: 6 }, (_, i) => ({
        value: `message${i}`,
        partition: 0,
    }));

    const messagesPartition1 = Array.from({ length: 11 }, (_, i) => ({
        value: `message${i}`,
        partition: 1,
    }));

    await producer.send({ topic: topicName, messages: messagesPartition0 });
    await producer.send({ topic: topicName, messages: messagesPartition1 });
    console.log("Messages sent to partitions 0 and 1");

    await producer.disconnect();

    try {
        const offsets = await admin.deleteTopicRecords({
            topic: topicName,
            partitions: [
                { partition: 0, offset: 10 },
                { partition: 1, offset: 4 },
            ],
        });

        // Log the entire offsets array for reference
        console.log("Delete Records: ", JSON.stringify(offsets, null, 2));

    } catch (error) {
        console.error("Error deleting topic records: ", error);
    }

    await admin.deleteTopics({
        topics: [topicName],
    });

    await admin.disconnect();
}

adminStart();