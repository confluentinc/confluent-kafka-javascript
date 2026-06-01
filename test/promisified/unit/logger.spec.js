jest.mock('../../../lib/rdkafka', () => {
  const { EventEmitter } = require('events');

  function makeStubClient(name) {
    const client = new EventEmitter();
    client.name = name;
    client.connect = jest.fn();
    client.disconnect = jest.fn();
    client.setPollInBackground = jest.fn();
    client.setDefaultIsTimeoutOnlyForFirstMessage = jest.fn();
    client.setDefaultConsumeTimeout = jest.fn();
    return client;
  }

  const captured = { producer: null, consumer: null, admin: null };

  function ProducerCtor() {
    captured.producer = makeStubClient('rdkafka#producer-test');
    return captured.producer;
  }

  function KafkaConsumerCtor() {
    captured.consumer = makeStubClient('rdkafka#consumer-test');
    return captured.consumer;
  }

  return {
    Producer: ProducerCtor,
    KafkaConsumer: KafkaConsumerCtor,
    AdminClient: {
      create: jest.fn((_config, listeners) => {
        const stub = {
          name: 'rdkafka#admin-test',
          on: jest.fn(),
          disconnect: jest.fn(),
          _listeners: listeners,
        };
        captured.admin = stub;
        if (listeners && typeof listeners.ready === 'function') {
          listeners.ready();
        }
        return stub;
      }),
    },
    CODES: { ERRORS: {} },
    __captured: captured,
  };
});

const { Kafka } = require('../../../lib/kafkajs');
const LibrdKafkaError = require('../../../lib/error');
const RdKafkaMock = require('../../../lib/rdkafka');

function makeLogger() {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  };
  logger.namespace = jest.fn(() => logger);
  return logger;
}

function brokerError() {
  return LibrdKafkaError.create(new Error('Local: broker transport failure'));
}

function expectStringFirstArg(mockFn, err) {
  expect(mockFn).toHaveBeenCalled();
  const [firstArg, secondArg] = mockFn.mock.calls[mockFn.mock.calls.length - 1];
  expect(firstArg).toEqual(`Error: ${err.message}`);
  expect(secondArg).toEqual(expect.objectContaining({
    fac: 'BINDING',
    name: expect.any(String),
    timestamp: expect.any(Number),
  }));
}

describe('user-supplied logger receives a string as the first arg on error callbacks', () => {
  beforeEach(() => {
    RdKafkaMock.__captured.producer = null;
    RdKafkaMock.__captured.consumer = null;
    RdKafkaMock.__captured.admin = null;
  });

  it('Producer #errorCb passes a string to logger.error', async () => {
    const logger = makeLogger();
    const producer = new Kafka({ kafkaJS: { brokers: ['x:1'], logger } }).producer();
    producer.connect().catch(() => {});

    const err = brokerError();
    RdKafkaMock.__captured.producer.emit('event.error', err);

    expectStringFirstArg(logger.error, err);
  });

  it('Consumer #errorCb passes a string to logger.error', async () => {
    const logger = makeLogger();
    const kafka = new Kafka({ kafkaJS: { brokers: ['x:1'], logger } });
    const consumer = kafka.consumer({ kafkaJS: { groupId: 'g' } });
    consumer.connect().catch(() => {});

    const err = brokerError();
    RdKafkaMock.__captured.consumer.emit('event.error', err);

    expectStringFirstArg(logger.error, err);
  });

  it('Admin #errorCb passes a string to logger.error', async () => {
    const logger = makeLogger();
    const admin = new Kafka({ kafkaJS: { brokers: ['x:1'], logger } }).admin();
    await admin.connect();

    const err = brokerError();
    RdKafkaMock.__captured.admin._listeners.error(err);

    expectStringFirstArg(logger.error, err);
  });
});
