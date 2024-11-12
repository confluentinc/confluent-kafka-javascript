const Kafka = require('@confluentinc/kafka-javascript');
const admin = require('../../lib/admin');

const bootstrapServers = 'localhost:9092';

function adminFromProducer() {
    const producer = new Kafka.Producer({
        'bootstrap.servers': bootstrapServers,
        'dr_msg_cb': true,
    });

    const createAdminAndListTopics = () => {
        // Create an admin client from the producer, which must be connected.
        // Thus, this is called from the producer's 'ready' event.
        const admin = Kafka.AdminClient.createFrom(producer);

        // The admin client can be used until the producer is connected.
        admin.listTopics((err, topics) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("Topics: ", topics);
            admin.disconnect();
        });
    };

    producer.connect();

    producer.on('ready', () => {
        console.log("Producer is ready");
        producer.setPollInterval(100);

        // After the producer is ready, it can be used to create an admin client.
        createAdminAndListTopics();

        // It can also be used normally to produce messages.
        producer.produce('test-topic', null, Buffer.from('Hello World!'), null, Date.now());
    });

    producer.on('event.error', (err) => {
        console.error(err);
    });

    producer.on('delivery-report', (err, report) => {
        console.log("Delivery report received:", report);
    });

    setTimeout(() => {
        producer.disconnect();
    }, 30000);
}

function adminFromConsumer() {
    const consumer = new Kafka.KafkaConsumer({
        'bootstrap.servers': bootstrapServers,
        'group.id': 'test-group',
        'auto.offset.reset': 'earliest',
    });

    const createAdminAndListTopics = () => {
        // Create an admin client from the consumer, which must be connected.
        // Thus, this is called from the consumer's 'ready' event.
        const admin = Kafka.AdminClient.createFrom(consumer);

        // The admin client can be used until the consumer is connected.
        admin.listTopics((err, topics) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("Topics: ", topics);
            admin.disconnect();
        });
    };

    consumer.connect();

    consumer.on('ready', () => {
        console.log("Consumer is ready");

        // After the consumer is ready, it can be used to create an admin client.
        createAdminAndListTopics();

        // It can also be used normally to consume messages.
        consumer.subscribe(['test-topic']);
        consumer.consume();
    });

    consumer.on('data', (data) => {
        console.log("Consumer:data", data);
    });

    consumer.on('event.error', (err) => {
        console.error("Consumer:error", err);
    });

    setTimeout(() => {
        consumer.disconnect();
    }, 30000);
}

adminFromProducer();
setTimeout(() => adminFromConsumer(), 35000);