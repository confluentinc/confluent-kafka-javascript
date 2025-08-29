import {KafkaJS as Confluent, RdKafka, TopicPartitionOffset} from "@confluentinc/kafka-javascript";
import {Admin, Consumer, EachMessagePayload, Kafka, Producer} from "kafkajs";
jest.setTimeout(120000);

const topicFn = () => `test-offset-topic-${Date.now()}`;
const standardGroupIdFn = () => `test-standard-group-${Date.now()}`;
const offsetGroupIdFn = () => `test-offset-group-${Date.now()}`;

describe("Seek offsets", () => {
  let kafka: Kafka | Confluent.Kafka;
  let admin: Admin | Confluent.Admin | undefined;
  let producer: Producer | Confluent.Producer | undefined;
  let standardConsumer: Consumer | Confluent.Consumer | undefined;
  let offsetConsumer: Consumer | Confluent.Consumer | undefined;

  let standardReady: boolean;
  let offsetReady: boolean;
  const total = 4;
  let received: number;
  let replayed: number;
  let offsets: (TopicPartitionOffset | Confluent.TopicPartitionOffset)[];

  beforeEach(() => {
    standardReady = false;
    offsetReady = false;
    received = 0;
    replayed = 0;
    offsets = [];
  });

  afterEach(async () => {
    await offsetConsumer?.disconnect();
    await standardConsumer?.disconnect();
    await producer?.disconnect();
    await admin?.disconnect();
  });

  // it("supports seeking consumer offsets with KafkaJS", async () => {
  //   console.log("Running seek offsets test with KafkaJS");
  //   kafka = new Kafka({brokers: ["localhost:9092"], logLevel: logLevel.NOTHING});
  //   admin = kafka.admin();
  //   await admin.connect();

  //   const topic = topicFn();
  //   await admin.createTopics({topics: [{topic, numPartitions: 1}]});
  //   producer = kafka.producer();
  //   await producer.connect();

  //   await sendMessages(topic);

  //   standardConsumer = kafka.consumer({groupId: standardGroupIdFn()});
  //   standardConsumer.on(standardConsumer.events.GROUP_JOIN, (event: any) => {
  //     standardReady = true;
  //   });
  //   await standardConsumer.connect();
  //   await standardConsumer.subscribe({topic, fromBeginning: true});
  //   await standardConsumer.run({eachMessage: doStandardConsumer});

  //   offsetConsumer = kafka.consumer({groupId: offsetGroupIdFn()});
  //   offsetConsumer.on(offsetConsumer.events.GROUP_JOIN, (event: any) => {
  //     offsetReady = true;
  //   });
  //   await offsetConsumer.connect();
  //   await offsetConsumer.subscribe({topic: topic, fromBeginning: true});
  //   await offsetConsumer.run({eachMessage: doOffsetConsumer});

  //   await doTest(topic);
  // });

  it("supports seeking consumer offsets with Confluent", async () => {
    console.log("Running seek offsets test with Confluent");
    kafka = new Confluent.Kafka({kafkaJS: {brokers: ["localhost:9092"], logLevel: Confluent.logLevel.NOTHING}});
    admin = kafka.admin();
    await admin.connect();

    const topic = topicFn();
    await admin.createTopics({topics: [{topic, numPartitions: 1}]});
    producer = kafka.producer();
    await producer.connect();

    await sendMessages(topic);

    standardConsumer = kafka.consumer({
      kafkaJS: {groupId: standardGroupIdFn(), fromBeginning: true, autoCommit: true, autoCommitInterval: 500},
      rebalance_cb: (err: any, assignment: any, consumer: any) => {
        if (err.code !== RdKafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS) return;
        if (!standardReady) standardReady = true;
      }
    });
    await standardConsumer.connect();
    await standardConsumer.subscribe({topic});
    await standardConsumer.run({eachMessage: doStandardConsumer});

  offsetConsumer = kafka.consumer({
    kafkaJS: {
      groupId: offsetGroupIdFn(),
      fromBeginning: true,
      autoCommit: true,
      autoCommitInterval: 500,
      // If the Confluent client supports a 'config' property, move configs here:
      // config: {
      //   'fetch.max.wait.ms': 100,
      //   'fetch.min.bytes': 1,
      //   'fetch.max.bytes': 10485760,
      //   'max.partition.fetch.bytes': 1048576,
      //   'session.timeout.ms': 30000,
      //   'heartbeat.interval.ms': 3000,
      // }
    },
    rebalance_cb: (err: any, assignment: any, consumer: any) => {
      if (err.code !== RdKafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS) return;
      if (!offsetReady) offsetReady = true;
    }
  });
    await offsetConsumer.connect();
    await offsetConsumer.subscribe({topic});
    await offsetConsumer.run({eachMessage: doOffsetConsumer});

    await doTest(topic);
  });

  it("pause and resume without seek (confluent)", async () => {
  console.log("Testing pause/resume without seek");
  kafka = new Confluent.Kafka({ kafkaJS: { brokers: ["localhost:9092"], logLevel: Confluent.logLevel.NOTHING } });
  admin = kafka.admin();
  await admin.connect();

  const topic = topicFn();
  await admin.createTopics({ topics: [{ topic, numPartitions: 1 }] });
  producer = kafka.producer();
  await producer.connect();
  await sendMessages(topic);

  offsetConsumer = kafka.consumer({
    kafkaJS: {
      groupId: offsetGroupIdFn(),
      fromBeginning: true,
      autoCommit: true,
      autoCommitInterval: 500,
      // If the Confluent client supports a 'config' property, move configs here:
      // config: {
      //   'fetch.max.wait.ms': 100,
      //   'fetch.min.bytes': 1,
      //   'fetch.max.bytes': 10485760,
      //   'max.partition.fetch.bytes': 1048576,
      //   'session.timeout.ms': 30000,
      //   'heartbeat.interval.ms': 3000,
      // }
    },
    rebalance_cb: (err: any, assignment: any, consumer: any) => {
      if (err.code !== RdKafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS) return;
      if (!offsetReady) offsetReady = true;
    }
  });
  await offsetConsumer.connect();
  await offsetConsumer.subscribe({ topic });
  replayed = 0;

  await offsetConsumer.run({
    eachMessage: async (payload) => {
      if (offsetConsumer) {
        offsetConsumer.pause([{ topic: payload.topic }]);
        offsetConsumer.resume([{ topic: payload.topic }]);
      }
      replayed++;
      const now = new Date();
    const localTimeWithMs = `${now.toLocaleString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      console.log(`[${localTimeWithMs}] Pause/Resume received offset: ${payload.message.offset}`);
    }
  });

  await until(() => replayed === total);
  await offsetConsumer.disconnect();
  await admin.disconnect();
  await producer.disconnect();
});

it("seek without pause/resume (confluent)", async () => {
  console.log("Testing seek without pause/resume");
  kafka = new Confluent.Kafka({ kafkaJS: { brokers: ["localhost:9092"], logLevel: Confluent.logLevel.NOTHING } });
  admin = kafka.admin();
  await admin.connect();

  const topic = topicFn();
  await admin.createTopics({ topics: [{ topic, numPartitions: 1 }] });
  producer = kafka.producer();
  await producer.connect();
  await sendMessages(topic);

  offsetConsumer = kafka.consumer({
    kafkaJS: {
      groupId: offsetGroupIdFn(),
      fromBeginning: true,
      autoCommit: true,
      autoCommitInterval: 500,
      // If the Confluent client supports a 'config' property, move configs here:
      // config: {
      //   'fetch.max.wait.ms': 100,
      //   'fetch.min.bytes': 1,
      //   'fetch.max.bytes': 10485760,
      //   'max.partition.fetch.bytes': 1048576,
      //   'session.timeout.ms': 30000,
      //   'heartbeat.interval.ms': 3000,
      // }
    },
    rebalance_cb: (err: any, assignment: any, consumer: any) => {
      if (err.code !== RdKafka.CODES.ERRORS.ERR__ASSIGN_PARTITIONS) return;
      if (!offsetReady) offsetReady = true;
    }
  });
  await offsetConsumer.connect();
  await offsetConsumer.subscribe({ topic });
  replayed = 0;

  await offsetConsumer.run({
    eachMessage: async (payload) => {
      const offsetNum = typeof payload.message.offset === 'string' ? parseInt(payload.message.offset) : payload.message.offset;
      // Only seek, never pause/resume
      if (offsetNum % 3 === 0 && offsetNum + 1 < total) {
        // Example: seek forward by 1
        if (offsetConsumer) {
          offsetConsumer.seek({ topic: payload.topic, partition: payload.partition, offset: String(offsetNum + 1) });
          const now = new Date();
    const localTimeWithMs = `${now.toLocaleString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
          console.log(`[${localTimeWithMs}] Seek from offset: ${offsetNum} to offset: ${offsetNum+1}`);
        }
      }
      replayed++;
    }
  });

  await until(() => replayed === total);
  await offsetConsumer.disconnect();
  await admin.disconnect();
  await producer.disconnect();
});


  async function sendMessages(topic: string) {
    for (let i = 0; i < total; i++) {
      await producer!.send({topic: topic, messages: [{value: "data"}]});
    }
  }

  async function doStandardConsumer(payload: EachMessagePayload | Confluent.EachMessagePayload) {
    const offset =
      typeof payload.message.offset === "string" ? parseInt(payload.message.offset) : payload.message.offset;
    console.log(
      `[${Date.now()}] Standard consumer received => partition: ${payload.partition}; offset: ${offset}`
    );
    received++;
    if (offset % 3 === 0) {
      offsets.push({topic: payload.topic, partition: payload.partition, offset});
    }
  }

  async function doOffsetConsumer(payload: EachMessagePayload | Confluent.EachMessagePayload) {
    const now = new Date();
    const localTimeWithMs = `${now.toLocaleString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    console.log(`[${localTimeWithMs}] Offset consumer received => partition: ${payload.partition}; offset: ${payload.message.offset}`);
    replayed++;
    offsetConsumer!.pause([{topic: payload.topic}]);
    offsetConsumer!.resume([{topic: payload.topic}]);
    //seekNextOffset(payload.topic);
  }

  async function doTest(topic: string) {
    await until(() => standardReady && offsetReady);
    offsetConsumer!.pause([{topic}]);

    await until(() => received === total);
    seekNextOffset(topic);

    await until(() => replayed === Math.ceil(total / 3));
  }

  function seekNextOffset(topic: string) {
  if (offsets.length) {
    const offset = offsets.shift();
    const now = new Date();
    const localTimeWithMs = `${now.toLocaleString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    console.log(`[${localTimeWithMs}] GOINGG TO RESUME (no seek)`, offset);
    // Remove or comment out the seek operation:
    // offsetConsumer!.seek(offset! as any);
    // const seekTime = `${new Date().toLocaleString()}.${new Date().getMilliseconds().toString().padStart(3, '0')}`;
    // console.log(`[${seekTime}] Seek to offset: ${offset!.offset}`);
    offsetConsumer!.resume([{topic: offset!.topic}]);
  }
}

  async function until(condition: () => boolean) {
    const timeout = 60000;
    const finish = Date.now() + timeout;
    while (Date.now() <= finish) {
      const result = condition();
      if (result) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Failed within ${timeout!}ms`);
  }
});
