import { describe, expect, it } from '@jest/globals'
import { AvroSerializer } from '../../serde/avro'
import { SerdeType } from '../../serde/serde'
import { RuleMode } from '../../schemaregistry-client'
import { SchemaRegistryClient, type Rule, type SchemaInfo } from '../../schemaregistry-client'
import { CelExecutor } from '../../rules/cel/cel-executor'
import { CelFieldExecutor } from '../../rules/cel/cel-field-executor'

CelExecutor.register()
CelFieldExecutor.register()

/**
 * A CEL_FIELD condition fails only when a rule actually evaluates to `false`. The Avro walk
 * returns an untargeted field's own value as the "result" for that field, so a falsy value -
 * `0`, `""`, or a null union branch - used to be read as a failed condition even when the rule
 * never ran on it. Java tests `Boolean.FALSE.equals`, and json.ts / protobuf.ts test `=== false`.
 */
const SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Falsy',
  fields: [
    { name: 'tagged', type: 'string', 'confluent:tags': ['PII'] },
    { name: 'num', type: 'int' },
    { name: 'str', type: 'string' },
    { name: 'opt', type: ['null', 'string'] },
  ],
})

async function serialize(subject: string, expr: string, msg: any): Promise<void> {
  const client = SchemaRegistryClient.newClient({ baseURLs: ['mock://'], cacheCapacity: 1000 })
  const ser = new AvroSerializer(client, SerdeType.VALUE, { useLatestVersion: true })
  const rule = {
    name: 'checkLen', kind: 'CONDITION', mode: RuleMode.WRITE, type: 'CEL_FIELD',
    tags: ['PII'], expr,
  } as any as Rule
  const info = {
    schemaType: 'AVRO', schema: SCHEMA, ruleSet: { domainRules: [rule] },
  } as any as SchemaInfo
  await client.register(`${subject}-value`, info, false)
  await ser.serialize(subject, msg)
}

describe('CEL_FIELD condition over falsy Avro fields', () => {
  const expr = 'size(value) > 0'

  it('passes when untargeted fields hold falsy values', async () => {
    await expect(serialize('falsy-untargeted', expr,
      { tagged: 'x', num: 0, str: '', opt: null })).resolves.toBeUndefined()
  })

  it('still fails when the rule itself evaluates to false', async () => {
    await expect(serialize('falsy-realfail', expr,
      { tagged: '', num: 1, str: 's', opt: 'o' })).rejects.toThrow(/checkLen|Expr failed/)
  })
})
