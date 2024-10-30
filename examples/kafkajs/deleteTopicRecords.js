// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require("@confluentinc/kafka-javascript").KafkaJS;

async function deleteTopicRecords() {
    const args = process.argv.slice(2);
    if (args.length < 3 || args.length % 2 !== 1) {
        console.error("Usage: node deleteTopicRecords.js <topic> <partition offset ...>");
        process.exit(1);
    }

    const [topic, ...rest] = args;

    const kafka = new Kafka({
        kafkaJS: {
            brokers: ["localhost:9092"],
        },
    });

    const admin = kafka.admin();
    await admin.connect();

    try {
        // Parse partitions and offsets, ensuring pairs of partition and offset are provided
        const partitionsInput = parsePartitionsAndOffsets(rest);

        // Delete records for the specified topic and partitions
        const result = await admin.deleteTopicRecords({
            topic: topic,
            partitions: partitionsInput,
        });

        console.log(`Records deleted for Topic "${topic}":`, JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error deleting topic records:", err);
    } finally {
        await admin.disconnect();
    }
}

// Helper function to parse partitions and offsets from arguments
function parsePartitionsAndOffsets(args) {
    const partitions = [];
    for (let i = 0; i < args.length; i += 2) {
        const partition = parseInt(args[i]);
        const offset = parseInt(args[i + 1]);
        if (isNaN(partition) || isNaN(offset)) {
            console.error("Partition and offset should be numbers and provided in pairs.");
            process.exit(1);
        }
        partitions.push({ partition, offset });
    }
    return partitions;
}

deleteTopicRecords();
