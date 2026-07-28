import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MockClient } from '../../mock-schemaregistry-client';
import { AvroSerializer, AvroSerializerConfig } from '../../serde/avro';
import {
  KAFKA_CLUSTER_ID,
  SerdeType,
  SerializationError,
  SubjectNameStrategyType,
} from '../../serde/serde';
import { LifecyclePolicy } from '../../schemaregistry-client';

/* The associated strategy, with the cluster id coming from the Kafka client
 * lazily: the client hands the serde a resolver once connected, and the
 * strategy calls it only when a subject lookup misses its cache. */
describe('AssociatedNameStrategy cluster id resolution', () => {
  let client: MockClient;

  const makeSerializer = (conf: AvroSerializerConfig = {}): AvroSerializer =>
    new AvroSerializer(client, SerdeType.VALUE, {
      autoRegisterSchemas: false,
      useLatestVersion: true,
      subjectNameStrategyType: SubjectNameStrategyType.ASSOCIATED,
      ...conf,
    });

  const associate = async (topic: string, namespace: string, subject: string) => {
    await client.createAssociation({
      resourceName: topic,
      resourceNamespace: namespace,
      resourceId: `${namespace}:${topic}`,
      resourceType: 'topic',
      associations: [{ subject, associationType: 'value', lifecycle: LifecyclePolicy.STRONG }],
    });
  };

  beforeEach(() => {
    client = new MockClient();
  });

  it('looks up under the wildcard namespace when nothing supplies a cluster id', async () => {
    await associate('topic1', '-', 'wildcard-subject');
    const ser = makeSerializer();
    expect(await ser.subjectName('topic1')).toBe('wildcard-subject');
  });

  it('does not invoke the resolver when it is handed over', () => {
    const resolver = jest.fn(async () => 'lkc-1');
    makeSerializer().setClusterIdResolver(resolver);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('uses the resolved cluster id as the namespace', async () => {
    await associate('topic1', 'lkc-1', 'resolved-subject');
    const resolver = jest.fn(async () => 'lkc-1');
    const ser = makeSerializer();
    ser.setClusterIdResolver(resolver);
    expect(await ser.subjectName('topic1')).toBe('resolved-subject');
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('invokes the resolver only on a subject cache miss', async () => {
    const resolver = jest.fn(async () => 'lkc-1');
    const ser = makeSerializer();
    ser.setClusterIdResolver(resolver);

    for (const topic of ['a', 'b', 'c']) {
      await ser.subjectName(topic);
    }
    expect(resolver).toHaveBeenCalledTimes(3);

    for (const topic of ['a', 'b', 'c', 'a']) {
      await ser.subjectName(topic);
    }
    expect(resolver).toHaveBeenCalledTimes(3);
  });

  it('uses the most recently handed over resolver', async () => {
    await associate('topic1', 'lkc-2', 'second-subject');
    const first = jest.fn(async () => 'lkc-1');
    const second = jest.fn(async () => 'lkc-2');
    const ser = makeSerializer();
    ser.setClusterIdResolver(first);
    ser.setClusterIdResolver(second);
    expect(await ser.subjectName('topic1')).toBe('second-subject');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('fails the lookup, naming the escape hatch, when the resolver throws and retries next time', async () => {
    await associate('topic1', 'lkc-1', 'resolved-subject');
    const cause = new Error('Local: Timed out');
    const resolver = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(cause)
      .mockResolvedValue('lkc-1');
    const ser = makeSerializer();
    ser.setClusterIdResolver(resolver);

    let thrown: unknown = null;
    try {
      await ser.subjectName('topic1');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(SerializationError);
    const error = thrown as SerializationError;
    expect(error.message).toContain(KAFKA_CLUSTER_ID);
    expect(error.message).toContain('Local: Timed out');
    expect(error.cause).toBe(cause);

    /* Nothing was cached for the failed lookup: the next one resolves again. */
    expect(await ser.subjectName('topic1')).toBe('resolved-subject');
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('fails the lookup when the resolver returns an empty id', async () => {
    const ser = makeSerializer();
    ser.setClusterIdResolver(async () => '');
    await expect(ser.subjectName('topic1')).rejects.toThrow(/empty/);
    await expect(ser.subjectName('topic1')).rejects.toThrow(KAFKA_CLUSTER_ID);
  });

  it('prefers the configured cluster id and never invokes the resolver', async () => {
    await associate('topic1', 'lkc-configured', 'configured-subject');
    await associate('topic1', 'lkc-resolved', 'resolved-subject');
    const resolver = jest.fn(async () => 'lkc-resolved');
    const ser = makeSerializer({ subjectNameStrategyConfig: { [KAFKA_CLUSTER_ID]: 'lkc-configured' } });
    ser.setClusterIdResolver(resolver);
    expect(await ser.subjectName('topic1')).toBe('configured-subject');
    expect(resolver).not.toHaveBeenCalled();
  });

  it('treats an empty configured cluster id as not configured', async () => {
    await associate('topic1', 'lkc-resolved', 'resolved-subject');
    const resolver = jest.fn(async () => 'lkc-resolved');
    const ser = makeSerializer({ subjectNameStrategyConfig: { [KAFKA_CLUSTER_ID]: '' } });
    ser.setClusterIdResolver(resolver);
    expect(await ser.subjectName('topic1')).toBe('resolved-subject');
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('does not see an association under the wildcard once a real cluster id resolves', async () => {
    await associate('topic1', '-', 'wildcard-subject');
    const ser = makeSerializer();
    ser.setClusterIdResolver(async () => 'lkc-1');
    /* Falls back to the topic name strategy. */
    expect(await ser.subjectName('topic1')).toBe('topic1-value');
  });

  it('ignores the resolver with a non-associated strategy', async () => {
    const resolver = jest.fn(async () => 'lkc-1');
    const ser = makeSerializer({ subjectNameStrategyType: SubjectNameStrategyType.TOPIC });
    ser.setClusterIdResolver(resolver);
    expect(await ser.subjectName('topic1')).toBe('topic1-value');
    expect(resolver).not.toHaveBeenCalled();
  });
});
