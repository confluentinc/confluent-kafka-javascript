// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;

async function adminFromConsumer() {
    const kafka = new Kafka({
      kafkaJS: {
        brokers: ['localhost:9092'],
      }
    });

    const consumer = kafka.consumer({
        kafkaJS: {
            groupId: 'test-group',
            fromBeginning: true,
        }
    });

    await consumer.connect();

    // The consumer can be used as normal
    await consumer.subscribe({ topic: 'test-topic' });
    consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log({
                topic,
                partition,
                offset: message.offset,
                key: message.key?.toString(),
                value: message.value.toString(),
            });
        },
    });

    // And the same consumer can create an admin client - the consumer must have successfully
    // been connected before the admin client can be created.
    const admin = consumer.dependentAdmin();
    await admin.connect();

    // The admin client can be used until the consumer is connected.
    const listTopicsResult = await admin.listTopics();
    console.log(listTopicsResult);

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Disconnect the consumer and admin clients in the correct order.
    await admin.disconnect();
    await consumer.disconnect();
}

async function adminFromProducer() {
    const kafka = new Kafka({
      kafkaJS: {
        brokers: ['localhost:9092'],
      }
    });

    const producer = kafka.producer({});

    await producer.connect();

    // The producer can be used as normal
    await producer.send({ topic: 'test-topic', messages: [{ value: 'Hello!' }] });

    // And the same producer can create an admin client - the producer must have successfully
    // been connected before the admin client can be created.
    const admin = producer.dependentAdmin();
    await admin.connect();

    // The admin client can be used until the producer is connected.
    const listTopicsResult = await admin.listTopics();
    console.log(listTopicsResult);

    // Disconnect the producer and admin clients in the correct order.
    await admin.disconnect();
    await producer.disconnect();
}

adminFromProducer().then(() => adminFromConsumer()).catch(console.error);
