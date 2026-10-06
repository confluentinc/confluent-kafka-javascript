// require('kafkajs') is replaced with require('@confluentinc/kafka-javascript').KafkaJS.
const { Kafka } = require('@confluentinc/kafka-javascript').KafkaJS;

// Note: The @confluentinc/schemaregistry will need to be installed separately to run this example,
//       as it isn't a dependency of confluent-kafka-javascript.
const {
    SchemaRegistryClient,
    kafkaAvroSerializerBuilder,
    kafkaAvroDeserializerBuilder,
} = require('@confluentinc/schemaregistry');

// Note: The Schema Registry serde integration used below (the serializer and
//       deserializer builder properties) is experimental and may change in
//       future releases.
//
// The Schema Registry client is owned by the application: it registers the
// schemas below and is shared with the serializer and deserializer through
// setSchemaRegistryClient, so neither of them closes it. To let a serde create
// and own its own client instead, use setClientConfig (see the README).
const registry = new SchemaRegistryClient({ baseURLs: ['<fill>'] })
const kafka = new Kafka({
    kafkaJS: {
        brokers: ['<fill>'],
        ssl: true,
        sasl: {
            mechanism: 'plain',
            username: '<fill>',
            password: '<fill>',
        },
    }
});

const topicName = 'test-topic';
const subjectName = topicName + '-value';

// The producer builds the serializer while it connects and applies it to every
// message value, so send() takes the plain object. useLatestVersion picks up the
// schema registered below rather than registering a new one.
let producer = kafka.producer({
    'js.value.serializer.builder': kafkaAvroSerializerBuilder()
        .setSchemaRegistryClient(registry)
        .setAvroSerializerConfig({ useLatestVersion: true }),
});

// Likewise the consumer builds the deserializer while it connects and applies
// it to every message value; the result is reported on message.deserializedValue.
let consumer = kafka.consumer({
    kafkaJS: {
        groupId: "test-group",
        fromBeginning: true,
    },
    'js.value.deserializer.builder': kafkaAvroDeserializerBuilder()
        .setSchemaRegistryClient(registry),
});

const schemaA = {
    type: 'record',
    namespace: 'test',
    name: 'A',
    fields: [
        { name: 'id', type: 'int' },
        { name: 'b', type: 'test.B' },
    ],
};

const schemaB = {
    type: 'record',
    namespace: 'test',
    name: 'B',
    fields: [{ name: 'id', type: 'int' }],
};

const run = async () => {
    // Register schemaB.
    await registry.register(
        'avro-b',
        {
            schemaType: 'AVRO',
            schema: JSON.stringify(schemaB),
        }
    );
    const response = await registry.getLatestSchemaMetadata('avro-b');
    const version = response.version

    // Register schemaA, which references schemaB.
    await registry.register(
        subjectName,
        {
            schemaType: 'AVRO',
            schema: JSON.stringify(schemaA),
            references: [
                {
                    name: 'test.B',
                    subject: 'avro-b',
                    version,
                },
            ],
        }
    )

    // Produce a message with schemaA. The value is serialized by the producer.
    await producer.connect()
    await producer.send({
        topic: topicName,
        messages: [{
            key: 'key',
            value: { id: 1, b: { id: 2 } },
        }]
    });
    console.log("Producer sent its message.")
    await producer.disconnect();
    producer = null;

    await consumer.connect()
    await consumer.subscribe({ topic: topicName })

    let messageRcvd = false;
    await consumer.run({
        eachMessage: async ({ message }) => {
            // The raw bytes stay in message.value; a deserializer that failed
            // reports its error on deserializedValue rather than throwing.
            const { value, error } = message.deserializedValue;
            if (error) {
                console.error("Consumer could not decode the message value:", error);
            } else {
                console.log("Consumer received message.\nRaw value: " + message.value.toString('hex') +
                    "\nDecoded value: " + JSON.stringify(value));
            }
            messageRcvd = true;
        },
    });

    // Wait around until we get a message, and then disconnect.
    while (!messageRcvd) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await consumer.disconnect();
    consumer = null;
}

run().catch (async e => {
    console.error(e);
    consumer && await consumer.disconnect();
    producer && await producer.disconnect();
    process.exit(1);
})
