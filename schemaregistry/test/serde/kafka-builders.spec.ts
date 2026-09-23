import { describe, expect, it, jest } from '@jest/globals';
import { ClientConfig } from '../../rest-service';
import { SerdeType, SubjectNameStrategyType } from '../../serde/serde';
import { kafkaAvroSerializerBuilder, kafkaAvroDeserializerBuilder } from '../../serde/avro';
import { kafkaJsonSerializerBuilder, kafkaJsonDeserializerBuilder } from '../../serde/json';
import { kafkaProtobufSerializerBuilder, kafkaProtobufDeserializerBuilder } from '../../serde/protobuf';
import { MockClient } from '../../mock-schemaregistry-client';
import { SchemaRegistryClient } from '../../schemaregistry-client';

const clientConfig: ClientConfig = { baseURLs: ['http://localhost:8081'], cacheCapacity: 512 };

type MakeBuilder = () => any;

const serializerBuilders: Array<[string, MakeBuilder]> = [
  ['avro', () => kafkaAvroSerializerBuilder<any>()],
  ['json', () => kafkaJsonSerializerBuilder<any>()],
  ['protobuf', () => kafkaProtobufSerializerBuilder<any>()],
];

const deserializerBuilders: Array<[string, MakeBuilder]> = [
  ['avro', () => kafkaAvroDeserializerBuilder<any>()],
  ['json', () => kafkaJsonDeserializerBuilder<any>()],
  ['protobuf', () => kafkaProtobufDeserializerBuilder<any>()],
];

const allBuilders = [...serializerBuilders, ...deserializerBuilders];

/* The serde-specific config setter of each builder. */
const setSerdeConfig = (builder: any, config: object): any => {
  for (const setter of ['setAvroSerializerConfig', 'setAvroDeserializerConfig',
    'setJsonSerializerConfig', 'setJsonDeserializerConfig',
    'setProtobufSerializerConfig', 'setProtobufDeserializerConfig']) {
    if (typeof builder[setter] === 'function') {
      return builder[setter](config);
    }
  }
  throw new Error('no serde config setter found');
};

/* An initializer setter of each builder. */
const setInitializer = (builder: any, init: (serde: any) => void): any => {
  if (typeof builder.setSerializerInitializer === 'function') {
    return builder.setSerializerInitializer(init);
  }
  return builder.setDeserializerInitializer(init);
};

describe('Kafka serde builders', () => {
  it.each(serializerBuilders)('%s serializer builder honours isKey', (_name, make) => {
    const value = make().setClientConfig(clientConfig).build({} as any, false)[0];
    const key = make().setClientConfig(clientConfig).build({} as any, true)[0];
    expect(value.serdeType).toBe(SerdeType.VALUE);
    expect(key.serdeType).toBe(SerdeType.KEY);
  });

  it.each(deserializerBuilders)('%s deserializer builder honours isKey', (_name, make) => {
    const value = make().setClientConfig(clientConfig).build({} as any, false)[0];
    const key = make().setClientConfig(clientConfig).build({} as any, true)[0];
    expect(value.serdeType).toBe(SerdeType.VALUE);
    expect(key.serdeType).toBe(SerdeType.KEY);
  });

  it.each(allBuilders)('%s builder hands the client configuration back unchanged', (_name, make) => {
    /* No Schema Registry property is read from the client configuration
     * today, so nothing is consumed: what the Kafka client receives is what
     * it passed in. */
    const config = { 'bootstrap.servers': 'localhost:9092', 'client.id': 'app' };
    const [serde, remaining] = make().setClientConfig(clientConfig).build(config as any, false);
    expect(serde).toBeDefined();
    expect(remaining).toEqual({ 'bootstrap.servers': 'localhost:9092', 'client.id': 'app' });
  });

  it.each(allBuilders)('%s builder requires a client config or a client', (_name, make) => {
    expect(() => make().build({} as any, false)[0])
      .toThrow('Schema Registry client configuration is required');
    expect(() => make().setClientConfig({ baseURLs: [] } as ClientConfig).build({} as any, false)[0])
      .toThrow('Schema Registry client baseURLs attribute is required');
  });

  it.each(allBuilders)('%s builder rejects both a client and a client config', (_name, make) => {
    const client = new MockClient();
    expect(() => make().setClientConfig(clientConfig).setSchemaRegistryClient(client).build({} as any, false)[0])
      .toThrow('Cannot specify both a Schema Registry client and a client configuration; use one or the other');
  });

  it('runs the serializer initializer', () => {
    let seen: unknown = null;
    const s = kafkaAvroSerializerBuilder<any>()
      .setClientConfig(clientConfig)
      .setSerializerInitializer((serializer) => { seen = serializer; })
      .build({} as any, false)[0];
    expect(seen).toBe(s);
  });

  it('runs the deserializer initializer', () => {
    let seen: unknown = null;
    const d = kafkaProtobufDeserializerBuilder<any>()
      .setClientConfig(clientConfig)
      .setDeserializerInitializer((deserializer) => { seen = deserializer; })
      .build({} as any, false)[0];
    expect(seen).toBe(d);
  });

  describe('Schema Registry client ownership', () => {
    it.each(allBuilders)('%s builder uses the supplied client and never closes it', async (_name, make) => {
      const client = new MockClient();
      const closeSpy = jest.spyOn(client, 'close');
      const serde: any = make().setSchemaRegistryClient(client).build({} as any, false)[0];
      expect(serde.client).toBe(client);

      await serde.close();
      await serde.close();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it.each(allBuilders)('%s builder owns the client it creates and closes it once', async (_name, make) => {
      const serde: any = make().setClientConfig(clientConfig).build({} as any, false)[0];
      expect(serde.client).toBeInstanceOf(SchemaRegistryClient);
      const closeSpy = jest.spyOn(serde.client, 'close');

      await serde.close();
      await serde.close();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it.each(allBuilders)('%s builder releases a created client when the serde constructor throws', (_name, make) => {
      /* An unknown fallback type makes the subject name strategy constructor throw. */
      const closeSpy = jest.spyOn(SchemaRegistryClient.prototype, 'close');
      try {
        const builder = setSerdeConfig(make().setClientConfig(clientConfig), {
          subjectNameStrategyConfig: { 'subject.name.strategy.fallback.type': 'BOGUS' },
        });
        expect(() => builder.build({} as any, false)[0]).toThrow('Invalid value for subject.name.strategy.fallback.type');
        expect(closeSpy).toHaveBeenCalledTimes(1);
      } finally {
        closeSpy.mockRestore();
      }
    });

    it.each(allBuilders)('%s builder leaves a supplied client alone when the serde constructor throws', (_name, make) => {
      const client = new MockClient();
      const closeSpy = jest.spyOn(client, 'close');
      const builder = setSerdeConfig(make().setSchemaRegistryClient(client), {
        subjectNameStrategyConfig: { 'subject.name.strategy.fallback.type': 'BOGUS' },
      });
      expect(() => builder.build({} as any, false)[0]).toThrow();
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it.each(allBuilders)('%s builder closes the serde when the initializer throws', (_name, make) => {
      const client = new MockClient();
      let built: any = null;
      const builder = setInitializer(make().setSchemaRegistryClient(client), (serde) => {
        built = serde;
        jest.spyOn(serde, 'close');
        throw new Error('initializer failed');
      });
      expect(() => builder.build({} as any, false)[0]).toThrow('initializer failed');
      expect(built).not.toBeNull();
      expect(built.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('cluster id resolver', () => {
    it.each(allBuilders)('%s builder stores the resolver without invoking it (ASSOCIATED strategy)', async (_name, make) => {
      const client = new MockClient();
      const resolver = jest.fn(async () => 'lkc-test');
      const serde: any = make().setSchemaRegistryClient(client).build({} as any, false)[0];
      /* Default strategy is ASSOCIATED with no configured cluster id. */
      serde.setClusterIdResolver(resolver);
      expect(resolver).not.toHaveBeenCalled();

      /* The first subject lookup needs it. */
      const subject = await serde.subjectName('topic1', undefined);
      expect(resolver).toHaveBeenCalledTimes(1);
      /* No association registered for the topic: falls back to <topic>-value. */
      expect(subject).toBe('topic1-value');
    });

    it.each(allBuilders)('%s builder ignores the resolver with the TOPIC strategy', async (_name, make) => {
      const client = new MockClient();
      const resolver = jest.fn(async () => 'lkc-test');
      const serde: any = setSerdeConfig(make().setSchemaRegistryClient(client), {
        subjectNameStrategyType: SubjectNameStrategyType.TOPIC,
      }).build({} as any, false)[0];
      serde.setClusterIdResolver(resolver);
      const subject = await serde.subjectName('topic1', undefined);
      expect(subject).toBe('topic1-value');
      expect(resolver).not.toHaveBeenCalled();
    });
  });
});
