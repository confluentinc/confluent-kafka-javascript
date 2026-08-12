import { beforeEach, describe, expect, it } from '@jest/globals';
import { create } from '@bufbuild/protobuf';
import { ClientConfig } from '../../rest-service';
import { AvroSerializer, AvroSerializerConfig } from '../../serde/avro';
import { JsonSerializer, JsonSerializerConfig } from '../../serde/json';
import { ProtobufSerializer, ProtobufSerializerConfig } from '../../serde/protobuf';
import { SerdeType, ValidationRulesExecution } from '../../serde/serde';
import { Client, SchemaRegistryClient } from '../../schemaregistry-client';
import { CelValidator } from '../../rules/cel/cel-validator';
import {
  ValidationDynamicMessageSchema,
  ValidationPersonSchema,
} from './test/validation_widget_pb';

/**
 * Serializer-level tests for inline validation rules — these exercise the
 * validationRulesExecution wiring. Per-rule CEL semantics are covered in
 * cel-validator.spec.ts and walker dispatch in validate-message.spec.ts.
 */
const baseURL = 'mock://'
const topic = 'topic1'
const subject = 'topic1-value'

// Record-level rule plus two field-level rules, matching the JVM client's test layout.
const avroSchema = JSON.stringify({
  type: 'record', name: 'Person', namespace: 'test',
  'confluent:rules': [{ name: 'ageNotInsane', expr: 'this.age <= 150' }],
  fields: [
    { name: 'age', type: 'int', 'confluent:rules': [{ name: 'agePositive', expr: 'this >= 0' }] },
    {
      name: 'name', type: 'string',
      'confluent:rules': [{ name: 'nameNotEmpty', doc: 'name must not be empty', expr: 'size(this) > 0' }],
    },
  ],
})

const jsonSchema = JSON.stringify({
  type: 'object', title: 'Person',
  'confluent:rules': [{ name: 'ageNotInsane', expr: 'this.age <= 150' }],
  properties: {
    age: { type: 'integer', 'confluent:rules': [{ name: 'agePositive', expr: 'this >= 0' }] },
    name: {
      type: 'string',
      'confluent:rules': [{ name: 'nameNotEmpty', doc: 'name must not be empty', expr: 'size(this) > 0' }],
    },
  },
})

let client: Client

beforeEach(() => {
  const conf: ClientConfig = { baseURLs: [baseURL], cacheCapacity: 1000 }
  client = SchemaRegistryClient.newClient(conf)
})

// --------------------------------------------------------------------------------------
// Avro
// --------------------------------------------------------------------------------------

async function avroSer(extra: Partial<AvroSerializerConfig> = {}): Promise<AvroSerializer> {
  await client.register(subject, { schemaType: 'AVRO', schema: avroSchema }, false)
  return new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true, ...extra })
}

describe('avro inline validation', () => {
  it('passes when all rules pass', async () => {
    const ser = await avroSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    expect((await ser.serialize(topic, { age: 30, name: 'Alice' })).length).toBeGreaterThan(0)
  })

  it('passes when validation is disabled', async () => {
    // age=-5 would fail agePositive, but validation is disabled by default.
    const ser = await avroSer()
    expect((await ser.serialize(topic, { age: -5, name: 'Alice' })).length).toBeGreaterThan(0)
  })

  it('fails when a field rule fails', async () => {
    const ser = await avroSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    await expect(ser.serialize(topic, { age: -5, name: 'Alice' })).rejects.toThrow(/agePositive/)
  })

  it('fails when a record rule fails', async () => {
    const ser = await avroSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    await expect(ser.serialize(topic, { age: 200, name: 'Alice' })).rejects.toThrow(/<root>: ageNotInsane/)
  })

  it('reports every violation', async () => {
    const ser = await avroSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    await expect(ser.serialize(topic, { age: -5, name: '' })).rejects.toThrow(/2 violations/)
    await expect(ser.serialize(topic, { age: -5, name: '' })).rejects.toThrow(/age: agePositive: this >= 0/)
    await expect(ser.serialize(topic, { age: -5, name: '' }))
      .rejects.toThrow(/name: nameNotEmpty: name must not be empty/)
  })

  it('reports a single violation when failFast is set', async () => {
    const ser = await avroSer({
      validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES,
      validationRulesFailFast: true,
    })
    await expect(ser.serialize(topic, { age: -5, name: '' })).rejects.toThrow(/1 violation\)/)
  })

  it.each([ValidationRulesExecution.BEFORE_DOMAIN_RULES, ValidationRulesExecution.AFTER_DOMAIN_RULES])(
    'validates in %s mode when no domain rules exist', async (mode) => {
      const ser = await avroSer({ validationRulesExecution: mode })
      await expect(ser.serialize(topic, { age: -5, name: 'Alice' })).rejects.toThrow(/agePositive/)
    })

  it('uses an explicitly supplied executor', async () => {
    const ser = await avroSer({
      validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES,
      validationRuleExecutor: new CelValidator(),
    })
    await expect(ser.serialize(topic, { age: -5, name: 'Alice' })).rejects.toThrow(/agePositive/)
  })
})

// --------------------------------------------------------------------------------------
// JSON Schema
// --------------------------------------------------------------------------------------

async function jsonSer(extra: Partial<JsonSerializerConfig> = {}): Promise<JsonSerializer> {
  await client.register(subject, { schemaType: 'JSON', schema: jsonSchema }, false)
  return new JsonSerializer(client, SerdeType.VALUE, { useLatestVersion: true, ...extra })
}

describe('json inline validation', () => {
  it('passes when all rules pass', async () => {
    const ser = await jsonSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    expect((await ser.serialize(topic, { age: 30, name: 'Alice' })).length).toBeGreaterThan(0)
  })

  it('passes when validation is disabled', async () => {
    const ser = await jsonSer()
    expect((await ser.serialize(topic, { age: -5, name: 'Alice' })).length).toBeGreaterThan(0)
  })

  it('fails when a field rule fails, with paths rooted at $', async () => {
    const ser = await jsonSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    await expect(ser.serialize(topic, { age: -5, name: 'Alice' })).rejects.toThrow(/\$\.age: agePositive/)
  })

  it('reports every violation', async () => {
    const ser = await jsonSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    await expect(ser.serialize(topic, { age: -5, name: '' })).rejects.toThrow(/2 violations/)
    await expect(ser.serialize(topic, { age: -5, name: '' })).rejects.toThrow(/agePositive/)
    await expect(ser.serialize(topic, { age: -5, name: '' })).rejects.toThrow(/nameNotEmpty/)
  })

  it('fails when an object rule fails', async () => {
    const ser = await jsonSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    await expect(ser.serialize(topic, { age: 200, name: 'Alice' })).rejects.toThrow(/\$: ageNotInsane/)
  })
})

// --------------------------------------------------------------------------------------
// Protobuf
// --------------------------------------------------------------------------------------

function protobufSer(extra: Partial<ProtobufSerializerConfig> = {}): ProtobufSerializer {
  const ser = new ProtobufSerializer(client, SerdeType.VALUE, { autoRegisterSchemas: true, ...extra })
  ser.registry.add(ValidationPersonSchema)
  ser.registry.add(ValidationDynamicMessageSchema)
  return ser
}

describe('protobuf inline validation', () => {
  it('passes when all rules pass', async () => {
    const ser = protobufSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    const msg = create(ValidationPersonSchema, { age: 30, name: 'Alice' })
    expect((await ser.serialize(topic, msg)).length).toBeGreaterThan(0)
  })

  it('passes when validation is disabled', async () => {
    const ser = protobufSer()
    const msg = create(ValidationPersonSchema, { age: -5, name: 'Alice' })
    expect((await ser.serialize(topic, msg)).length).toBeGreaterThan(0)
  })

  it('fails when a field rule fails, preferring the rule doc', async () => {
    const ser = protobufSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    const msg = create(ValidationPersonSchema, { age: -5, name: 'Alice' })
    await expect(ser.serialize(topic, msg)).rejects.toThrow(/age must not be negative/)
  })

  it('fails when a message rule fails', async () => {
    const ser = protobufSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    const msg = create(ValidationPersonSchema, { age: 200, name: 'Alice' })
    await expect(ser.serialize(topic, msg)).rejects.toThrow(/<root>: ageNotInsane/)
  })

  it('reports every violation', async () => {
    const ser = protobufSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    const msg = create(ValidationPersonSchema, { age: 200, name: '' })
    await expect(ser.serialize(topic, msg)).rejects.toThrow(/2 violations/)
  })

  it('reports a dynamic failure message', async () => {
    const ser = protobufSer({ validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES })
    const msg = create(ValidationDynamicMessageSchema, { age: -5 })
    await expect(ser.serialize(topic, msg)).rejects.toThrow(/age must be positive, got -5/)
  })

  it('reads rules from the schema being written, not the local descriptor', async () => {
    // Register the schema under the subject, then write against it with useLatestVersion so
    // the rules have to come from the descriptor parsed out of the registered schema.
    const registrar = protobufSer()
    await registrar.serialize(topic, create(ValidationPersonSchema, { age: 30, name: 'Alice' }))

    const ser = protobufSer({
      autoRegisterSchemas: false,
      useLatestVersion: true,
      validationRulesExecution: ValidationRulesExecution.AFTER_DOMAIN_RULES,
    })
    await expect(ser.serialize(topic, create(ValidationPersonSchema, { age: -5, name: 'Alice' })))
      .rejects.toThrow(/age must not be negative/)
    const valid = await ser.serialize(topic, create(ValidationPersonSchema, { age: 30, name: 'Alice' }))
    expect(valid.length).toBeGreaterThan(0)
  })
})
