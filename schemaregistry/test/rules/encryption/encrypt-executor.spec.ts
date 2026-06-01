import { describe, expect, it } from '@jest/globals';
import { EncryptionExecutor, FieldEncryptionExecutor } from '../../../rules/encryption/encrypt-executor';
import { ClientConfig } from '../../../rest-service';
import { MockDekRegistryClient } from '../../../rules/encryption/dekregistry/mock-dekregistry-client';
import { Rule, RuleMode, SchemaInfo } from '../../../schemaregistry-client';
import { RuleContext } from '../../../serde/serde';

function newContext(subject: string): RuleContext {
  const rule: Rule = {
    name: 'rule1',
    type: 'ENCRYPT_PAYLOAD',
    mode: RuleMode.WRITE,
    params: {'encrypt.kek.name': 'kek1'},
  }
  const target: SchemaInfo = {schema: '"string"'}
  return new RuleContext(undefined, null, target, subject, '', false, RuleMode.WRITE,
    rule, 0, [rule], null, async (_ctx, _transform, msg) => msg)
}

describe('EncryptionExecutor', () => {
  it('getOrCreateKek uses context from subject', async () => {
    const clientConfig: ClientConfig = {baseURLs: ['mock://'], cacheCapacity: 1000}
    const client = new MockDekRegistryClient(clientConfig)
    // Pre-register the same kek name under two different contexts, with a
    // different kmsKeyId each, so a wrong (or dropped) context shows up as a
    // mismatched kmsKeyId rather than just "it didn't throw".
    await client.registerKek('kek1', 'local-kms', 'myctxkey', false, undefined, undefined, '.myctx')
    await client.registerKek('kek1', 'local-kms', 'defaultkey', false, undefined, undefined, undefined)

    const executor = new EncryptionExecutor()
    executor.client = client

    // Context-qualified subject: the context should be parsed out of the
    // subject and threaded through to the dek registry client, not dropped.
    const transform = executor.newTransform(newContext(':.myctx:widget-value'))
    const kek = await transform.getOrCreateKek(newContext(':.myctx:widget-value'))
    expect(kek.kmsKeyId).toEqual('myctxkey')

    // Unqualified subject (default context): the context should normalize to
    // undefined rather than being looked up under the literal "." context.
    const transform2 = executor.newTransform(newContext('widget-value'))
    const kek2 = await transform2.getOrCreateKek(newContext('widget-value'))
    expect(kek2.kmsKeyId).toEqual('defaultkey')

    // Explicitly-qualified default context (":.:subject"): should behave
    // identically to an unqualified subject, not be looked up under the
    // literal "." context.
    const transform3 = executor.newTransform(newContext(':.:widget-value'))
    const kek3 = await transform3.getOrCreateKek(newContext(':.:widget-value'))
    expect(kek3.kmsKeyId).toEqual('defaultkey')
  })
})

describe('FieldEncryptionExecutor', () => {
  it('configure error', () => {
    const executor = new FieldEncryptionExecutor()
    const clientConfig: ClientConfig = {
      baseURLs: ['mock://'],
      cacheCapacity: 1000
    }
    const config = new Map<string, string>();
    config.set('key', 'value');
    executor.configure(clientConfig, config);
    // configure with same args is fine
    executor.configure(clientConfig, config);
    const config2 = new Map<string, string>();
    config2.set('key2', 'value2');
    // configure with additional config keys is fine
    executor.configure(clientConfig, config);

    const clientConfig2: ClientConfig = {
      baseURLs: ['blah://'],
      cacheCapacity: 1000
    }
    expect(() => executor.configure(clientConfig2, config)).toThrowError()

    const config3  = new Map<string, string>();
    config3.set('key', 'value3');
    expect(() => executor.configure(clientConfig, config3)).toThrowError()
  })
})
