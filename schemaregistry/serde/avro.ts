import {
  Deserializer, DeserializerConfig,
  evaluateValidationRule,
  FieldTransform,
  FieldType, Migration, parseValidationRules, RefResolver,
  RuleConditionError,
  RuleContext, SchemaId, SerdeType, SerializationError,
  Serializer, SerializerConfig,
  ValidationRule, ValidationRuleError, ValidationRuleExecutor, ValidationRulesExecution
} from "./serde";
import {
  Client, RuleMode, RulePhase,
  SchemaInfo
} from "../schemaregistry-client";
import avro, {ForSchemaOptions, Type, types} from "avsc";
import UnwrappedUnionType = types.UnwrappedUnionType
import WrappedUnionType = types.WrappedUnionType
import ArrayType = types.ArrayType
import MapType = types.MapType
import RecordType = types.RecordType
import Field = types.Field
import { LRUCache } from 'lru-cache'
import {RuleRegistry} from "./rule-registry";
import stringify from "json-stringify-deterministic";
import type {IHeaders} from "@confluentinc/kafka-javascript/types/kafkajs";

export const AVRO_TYPE = "AVRO"

type TypeHook = (schema: avro.Schema, opts: ForSchemaOptions) => Type | undefined

export type AvroSerdeConfig = Partial<ForSchemaOptions>

export interface AvroSerde {
  schemaToTypeCache: LRUCache<string, [avro.Type, Map<string, string>]>
}

/**
 * AvroSerializerConfig is used to configure the AvroSerializer.
 */
export type AvroSerializerConfig = SerializerConfig & AvroSerdeConfig

/**
 * AvroSerializer is used to serialize messages using Avro.
 */
export class AvroSerializer extends Serializer implements AvroSerde {
  schemaToTypeCache: LRUCache<string, [avro.Type, Map<string, string>]>

  /**
   * Create a new AvroSerializer.
   * @param client - the schema registry client
   * @param serdeType - the type of the serializer
   * @param conf - the serializer configuration
   * @param ruleRegistry - the rule registry
   */
  constructor(client: Client, serdeType: SerdeType, conf: AvroSerializerConfig, ruleRegistry?: RuleRegistry) {
    super(client, serdeType, conf, ruleRegistry)
    this.schemaToTypeCache = new LRUCache<string, [Type, Map<string, string>]>({ max: this.conf.cacheCapacity ?? 1000 })
    this.fieldTransformer = async (ctx: RuleContext, fieldTransform: FieldTransform, msg: any) => {
      return await this.fieldTransform(ctx, fieldTransform, msg)
    }
    for (const rule of this.ruleRegistry.getExecutors()) {
      rule.configure(client.config(), new Map<string, string>(Object.entries(conf.ruleConfig ?? {})))
    }
    this.configureSubjectNameStrategy(
      conf.subjectNameStrategyType,
      conf.subjectNameStrategyConfig ?? {},
      this.getRecordName.bind(this)
    )
  }

  /**
   * serialize is used to serialize a message using Avro.
   * @param topic - the topic to serialize the message for
   * @param msg - the message to serialize
   * @param headers - optional headers
   */
  override async serialize(topic: string, msg: any, headers?: IHeaders): Promise<Buffer> {
    if (this.client == null) {
      throw new Error('client is not initialized')
    }
    if (msg == null) {
      throw new Error('message is empty')
    }

    let schema: SchemaInfo | undefined = undefined
    // Don't derive the schema if it is being looked up in the following ways
    if (this.config().useSchemaId == null &&
        !this.config().useLatestVersion &&
        this.config().useLatestWithMetadata == null) {
      const avroSchema = AvroSerializer.messageToSchema(msg)
      schema = {
        schemaType: 'AVRO',
        schema: JSON.stringify(avroSchema),
      }
    }
    const [schemaId, info] = await this.getSchemaId(AVRO_TYPE, topic, msg, schema)
    let avroType: avro.Type
    let deps: Map<string, string>
    [avroType, deps] = await this.toType(info)
    const subject = await this.subjectName(topic, info)
    if (this.validationEnabled(ValidationRulesExecution.BEFORE_DOMAIN_RULES)) {
      await this.validateInlineRules(avroType, info, deps, msg)
    }
    msg = await this.executeRules(
      subject, topic, RuleMode.WRITE, null, info, msg, getInlineTags(info, deps))
    if (this.validationEnabled(ValidationRulesExecution.AFTER_DOMAIN_RULES)) {
      await this.validateInlineRules(avroType, info, deps, msg)
    }
    avroType.isValid(msg, {errorHook: (path, any, type) => {
      throw new SerializationError(
        `Invalid message at ${path.join('.')}, expected ${type}, got ${stringify(any)}`)
    }})
    let msgBytes = avroType.typeName === 'bytes' ? msg : avroType.toBuffer(msg)
    msgBytes = await this.executeRulesWithPhase(
      subject, topic, RulePhase.ENCODING, RuleMode.WRITE, null, info, msgBytes, null)
    return this.serializeSchemaId(topic, msgBytes, schemaId, headers)
  }

  /**
   * Evaluates the schema's inline validation rules against msg, throwing a single
   * SerializationError listing every violation found.
   * @param avroType - the parsed schema
   * @param info - the schema
   * @param deps - the resolved schema dependencies
   * @param msg - the message to validate
   */
  async validateInlineRules(avroType: Type, info: SchemaInfo, deps: Map<string, string>, msg: any): Promise<void> {
    const violations = await validateAvroMessage(
      this.validationRuleExecutor(),
      avroType,
      getInlineValidationRules(info, deps),
      msg,
      Boolean(this.config().validationRulesFailFast))
    this.raiseValidationViolations(violations)
  }

  async fieldTransform(ctx: RuleContext, fieldTransform: FieldTransform, msg: any): Promise<any> {
    const [schema, ] = await this.toType(ctx.target)
    return await transform(ctx, schema, msg, fieldTransform)
  }

  async toType(info: SchemaInfo): Promise<[Type, Map<string, string>]> {
    return toType(this.client, this.conf as AvroDeserializerConfig, this, info, async (client, info) => {
      const deps = new Map<string, string>()
      await this.resolveReferences(client, info, deps)
      return deps
    })
  }

  async getRecordName(info?: SchemaInfo): Promise<string> {
    if (info == null) {
      return ''
    }
    const [type, ] = await this.toType(info)
    if (type.typeName === 'record') {
      return (type as RecordType).name ?? ''
    }
    return ''
  }

  static messageToSchema(msg: any): avro.Type {
    let enumIndex = 1
    let fixedIndex = 1
    let recordIndex = 1

    const namingHook: TypeHook = (
      avroSchema: avro.Schema,
      opts: ForSchemaOptions,
    ) => {
      let schema = avroSchema as any
      switch (schema.type) {
        case 'enum':
          schema.name = `Enum${enumIndex++}`;
          break;
        case 'fixed':
          schema.name = `Fixed${fixedIndex++}`;
          break;
        case 'record':
          schema.name = `Record${recordIndex++}`;
          break;
        default:
      }
      return undefined
    }

    return Type.forValue(msg, { typeHook: namingHook })
  }
}

/**
 * AvroDeserializerConfig is used to configure the AvroDeserializer.
 */
export type AvroDeserializerConfig = DeserializerConfig & AvroSerdeConfig

/**
 * AvroDeserializer is used to deserialize messages using Avro.
 */
export class AvroDeserializer extends Deserializer implements AvroSerde {
  schemaToTypeCache: LRUCache<string, [avro.Type, Map<string, string>]>

  /**
   * Create a new AvroDeserializer.
   * @param client - the schema registry client
   * @param serdeType - the type of the deserializer
   * @param conf - the deserializer configuration
   * @param ruleRegistry - the rule registry
   */
  constructor(client: Client, serdeType: SerdeType, conf: AvroDeserializerConfig, ruleRegistry?: RuleRegistry) {
    super(client, serdeType, conf, ruleRegistry)
    this.schemaToTypeCache = new LRUCache<string, [Type, Map<string, string>]>({ max: this.conf.cacheCapacity ?? 1000 })
    this.fieldTransformer = async (ctx: RuleContext, fieldTransform: FieldTransform, msg: any) => {
      return await this.fieldTransform(ctx, fieldTransform, msg)
    }
    for (const rule of this.ruleRegistry.getExecutors()) {
      rule.configure(client.config(), new Map<string, string>(Object.entries(conf.ruleConfig ?? {})))
    }
    this.configureSubjectNameStrategy(
      conf.subjectNameStrategyType,
      conf.subjectNameStrategyConfig ?? {},
      this.getRecordName.bind(this)
    )
  }

  /**
   * Deserializes a message.
   * @param topic - the topic
   * @param payload - the message payload
   * @param headers - optional headers
   */
  override async deserialize(topic: string, payload: Buffer, headers?: IHeaders): Promise<any> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('Invalid buffer')
    }
    if (payload.length === 0) {
      return null
    }

    const schemaId = new SchemaId(AVRO_TYPE)
    const [info, bytesRead] = await this.getWriterSchema(topic, payload, schemaId, headers)
    payload = payload.subarray(bytesRead)
    const subject = await this.subjectName(topic, info)
    payload = await this.executeRulesWithPhase(
      subject, topic, RulePhase.ENCODING, RuleMode.READ, null, info, payload, null)
    const readerMeta = await this.getReaderSchema(subject)
    let migrations: Migration[] = []
    if (readerMeta != null) {
      migrations = await this.getMigrations(subject, info, readerMeta)
    }
    const [writer, deps] = await this.toType(info)

    let msg: any
    const msgBytes = payload
    if (migrations.length > 0) {
      msg = writer.typeName === 'bytes' ? msgBytes : writer.fromBuffer(msgBytes)
      msg = await this.executeMigrations(migrations, subject, topic, msg)
    } else {
      if (writer.typeName === 'bytes') {
        msg = msgBytes
      } else {
        if (readerMeta != null) {
          const [reader, ] = await this.toType(readerMeta)
          if (reader.equals(writer)) {
            msg = reader.fromBuffer(msgBytes)
          } else {
            msg = reader.fromBuffer(msgBytes, reader.createResolver(writer))
          }
        } else {
          msg = writer.fromBuffer(msgBytes)
        }
      }
    }
    let target: SchemaInfo
    if (readerMeta != null) {
      target = readerMeta
    } else {
      target = info
    }
    msg = await this.executeRules(
      subject, topic, RuleMode.READ, null, target, msg, getInlineTags(info, deps))
    return msg
  }

  async fieldTransform(ctx: RuleContext, fieldTransform: FieldTransform, msg: any): Promise<any> {
    const [schema, ] = await this.toType(ctx.target)
    return await transform(ctx, schema, msg, fieldTransform)
  }

  async toType(info: SchemaInfo): Promise<[Type, Map<string, string>]> {
    return toType(this.client, this.conf as AvroDeserializerConfig, this, info, async (client, info) => {
      const deps = new Map<string, string>()
      await this.resolveReferences(client, info, deps)
      return deps
    })
  }

  async getRecordName(info?: SchemaInfo): Promise<string> {
    if (info == null) {
      return ''
    }
    const [type, ] = await this.toType(info)
    if (type.typeName === 'record') {
      return (type as RecordType).name ?? ''
    }
    return ''
  }
}

async function toType(
  client: Client,
  conf: AvroSerdeConfig,
  serde: AvroSerde,
  info: SchemaInfo,
  refResolver: RefResolver,
): Promise<[Type, Map<string, string>]> {
  let tuple = serde.schemaToTypeCache.get(stringify(info.schema))
  if (tuple != null) {
    return tuple
  }

  const deps = await refResolver(client, info)

  const addReferencedSchemas = (userHook?: TypeHook): TypeHook | undefined => (
    schema: avro.Schema,
    opts: ForSchemaOptions,
  ) => {
    const avroOpts = opts as AvroSerdeConfig
    deps.forEach((schema, _name) => {
      avroOpts.typeHook = userHook
      avro.Type.forSchema(JSON.parse(schema), avroOpts)
    })
    if (userHook) {
      return userHook(schema, opts)
    }
    return
  }

  const avroOpts = conf
  let type = avro.Type.forSchema(JSON.parse(info.schema), {
    ...avroOpts,
    typeHook: addReferencedSchemas(avroOpts?.typeHook),
  })
  serde.schemaToTypeCache.set(stringify(info.schema), [type, deps])
  return [type, deps]
}

async function transform(ctx: RuleContext, schema: Type, msg: any, fieldTransform: FieldTransform): Promise<any> {
  if (msg == null || schema == null) {
    return msg
  }
  const fieldCtx = ctx.currentField()
  if (fieldCtx != null) {
    fieldCtx.type = getType(schema)
  }
  switch (schema.typeName) {
    case 'union:unwrapped':
    case 'union:wrapped':
      let [subschema, submsg] = resolveUnion(schema, msg)
      if (subschema == null) {
        return msg
      }
      submsg = await transform(ctx, subschema, submsg, fieldTransform)
      if (schema.typeName === 'union:wrapped') {
        return {[subschema.branchName!]: submsg}
      }
      return submsg
    case 'array':
      const arraySchema = schema as ArrayType
      const array = msg as any[]
      for (let i = 0; i < array.length; i++) {
        array[i] = await transform(ctx, arraySchema.itemsType, array[i], fieldTransform)
      }
      return array
    case 'map':
      const mapSchema = schema as MapType
      const map = msg as { [key: string]: any }
      for (const key of Object.keys(map)) {
        map[key] = await transform(ctx, mapSchema.valuesType, map[key], fieldTransform)
      }
      return map
    case 'record':
      const recordSchema = schema as RecordType
      const record = msg as Record<string, any>
      for (const field of recordSchema.fields) {
        if (!(field.name in record)) {
          continue
        }
        await transformField(ctx, recordSchema, field, record, fieldTransform)
      }
      return record
    default:
      if (fieldCtx != null) {
        const ruleTags = ctx.rule.tags ?? []
        if (ruleTags == null || ruleTags.length === 0 || !disjoint(new Set<string>(ruleTags), fieldCtx.tags)) {
          return await fieldTransform.transform(ctx, fieldCtx, msg)
        }
      }
      return msg
  }
}

async function transformField(
  ctx: RuleContext,
  recordSchema: RecordType,
  field: Field,
  record: Record<string, any>,
  fieldTransform: FieldTransform,
): Promise<void> {
  const fullName = recordSchema.name + '.' + field.name
  try {
    ctx.enterField(
      record,
      fullName,
      field.name,
      getType(field.type),
      null
    )
    const newVal = await transform(ctx, field.type, record[field.name], fieldTransform)
    if (ctx.rule.kind === 'CONDITION') {
      if (!newVal) {
        throw new RuleConditionError(ctx.rule)
      }
    } else {
      record[field.name] = newVal
    }
  } finally {
    ctx.leaveField()
  }
}

/**
 * InlineValidationRules holds the inline validation rules declared in a schema, keyed by
 * the fully qualified record name for record-level rules and by `recordName.fieldName`
 * for field-level rules.
 */
export interface InlineValidationRules {
  recordRules: Map<string, ValidationRule[]>
  fieldRules: Map<string, ValidationRule[]>
}

/**
 * Reads the inline validation rules out of a schema and its dependencies.
 *
 * avsc drops unknown schema attributes when building a Type, so the rules are read from
 * the raw schema JSON and looked up by name during the walk — the same approach
 * getInlineTags takes for tags.
 * @param info - the schema
 * @param deps - the resolved schema dependencies
 */
export function getInlineValidationRules(info: SchemaInfo, deps: Map<string, string>): InlineValidationRules {
  const rules: InlineValidationRules = { recordRules: new Map(), fieldRules: new Map() }
  getInlineValidationRulesRecursively('', '', JSON.parse(info.schema), rules)
  for (const depSchema of deps.values()) {
    getInlineValidationRulesRecursively('', '', JSON.parse(depSchema), rules)
  }
  return rules
}

// iterate over the object and get all properties named 'confluent:rules'
function getInlineValidationRulesRecursively(
  ns: string, name: string, schema: any, rules: InlineValidationRules): void {
  if (schema == null || typeof schema === 'string') {
    return
  } else if (Array.isArray(schema)) {
    for (let i = 0; i < schema.length; i++) {
      getInlineValidationRulesRecursively(ns, name, schema[i], rules)
    }
  } else if (typeof schema === 'object') {
    const type = schema['type']
    switch (type) {
      case 'array':
        getInlineValidationRulesRecursively(ns, name, schema['items'], rules)
        break;
      case 'map':
        getInlineValidationRulesRecursively(ns, name, schema['values'], rules)
        break;
      case 'record': {
        let recordNs = schema['namespace']
        let recordName = schema['name']
        if (recordNs === undefined) {
          recordNs = impliedNamespace(name)
        }
        if (recordNs == null) {
          recordNs = ns
        }
        if (recordNs !== '' && !recordName.startsWith(recordNs)) {
          recordName = recordNs + '.' + recordName
        }
        const recordRules = parseValidationRules(schema['confluent:rules'])
        if (recordRules.length > 0) {
          rules.recordRules.set(recordName, recordRules)
        }
        const fields = schema['fields']
        for (const field of fields) {
          const fieldName = field['name']
          if (fieldName !== undefined) {
            const fieldRules = parseValidationRules(field['confluent:rules'])
            if (fieldRules.length > 0) {
              rules.fieldRules.set(recordName + '.' + fieldName, fieldRules)
            }
          }
          const fieldType = field['type']
          if (fieldType !== undefined) {
            getInlineValidationRulesRecursively(recordNs, recordName, fieldType, rules)
          }
        }
        break;
      }
    }
  }
}

/**
 * Walks msg against schema, evaluating every inline validation rule encountered and
 * collecting all failures. Read-only — the message is not modified.
 *
 * Two kinds of rules are evaluated:
 * - Record-level (`confluent:rules` on a record schema) — `this` is the record.
 * - Field-level (`confluent:rules` on a record's field) — `this` is the field value.
 *   Honors the skip-on-null contract: a field that is absent or null does not have its
 *   rules invoked.
 *
 * Failures are returned with their dotted-path location (e.g. `addr.zip`, `tags[3]`,
 * `scores["foo"]`). The walk continues after each failure so callers see the full set
 * rather than only the first, unless failFast is set.
 * @param executor - the validation rule executor
 * @param schema - the schema to walk
 * @param rules - the inline validation rules read from the raw schema
 * @param msg - the message to validate
 * @param failFast - whether to stop at the first violation
 */
export async function validateAvroMessage(
  executor: ValidationRuleExecutor,
  schema: Type,
  rules: InlineValidationRules,
  msg: any,
  failFast: boolean,
): Promise<ValidationRuleError[]> {
  const out: ValidationRuleError[] = []
  if (executor == null || schema == null || msg == null) {
    return out
  }
  await validate(executor, schema, rules, '', msg, failFast, out)
  return out
}

/**
 * Mirrors transform's switch-on-typeName dispatch shape.
 */
async function validate(
  executor: ValidationRuleExecutor,
  schema: Type,
  rules: InlineValidationRules,
  path: string,
  msg: any,
  failFast: boolean,
  out: ValidationRuleError[],
): Promise<void> {
  if (schema == null || msg == null) {
    return
  }
  switch (schema.typeName) {
    case 'union:unwrapped':
    case 'union:wrapped': {
      const [subschema, submsg] = resolveUnion(schema, msg)
      if (subschema == null) {
        return
      }
      await validate(executor, subschema, rules, path, submsg, failFast, out)
      return
    }
    case 'array': {
      const arraySchema = schema as ArrayType
      if (!Array.isArray(msg)) {
        return
      }
      for (let i = 0; i < msg.length; i++) {
        await validate(executor, arraySchema.itemsType, rules, `${path}[${i}]`, msg[i], failFast, out)
        if (failFast && out.length > 0) {
          return
        }
      }
      return
    }
    case 'map': {
      const mapSchema = schema as MapType
      // An array is an object in JS, so reject it explicitly: iterating it as a map would
      // walk numeric keys and report violations against a shape the schema never allowed.
      if (typeof msg !== 'object' || Array.isArray(msg)) {
        return
      }
      for (const key of Object.keys(msg)) {
        await validate(executor, mapSchema.valuesType, rules, `${path}["${key}"]`, msg[key], failFast, out)
        if (failFast && out.length > 0) {
          return
        }
      }
      return
    }
    case 'record': {
      const recordSchema = schema as RecordType
      if (typeof msg !== 'object' || Array.isArray(msg)) {
        return
      }
      const recordName = recordSchema.name ?? ''
      // Record-level rules: this = the record value.
      for (const rule of rules.recordRules.get(recordName) ?? []) {
        await evaluateValidationRule(executor, rule, recordSchema, msg, path, out)
        if (failFast && out.length > 0) {
          return
        }
      }
      for (const field of recordSchema.fields) {
        const value = msg[field.name]
        const childPath = path ? `${path}.${field.name}` : field.name
        // Skip-on-null: an absent or null field value does not invoke the executor.
        // The recursion below still runs but no-ops for null.
        if (value != null) {
          for (const rule of rules.fieldRules.get(`${recordName}.${field.name}`) ?? []) {
            await evaluateValidationRule(executor, rule, field.type, value, childPath, out)
            if (failFast && out.length > 0) {
              return
            }
          }
        }
        await validate(executor, field.type, rules, childPath, value, failFast, out)
        if (failFast && out.length > 0) {
          return
        }
      }
      return
    }
    default:
      // primitive leaf — field-level rules were evaluated by the parent record case
  }
}

function getType(schema: Type): FieldType {
  switch (schema.typeName) {
    case 'record':
      return FieldType.RECORD
    case 'enum':
      return FieldType.ENUM
    case 'array':
      return FieldType.ARRAY
    case 'map':
      return FieldType.MAP
    case 'union:unwrapped':
    case 'union:wrapped':
      return FieldType.COMBINED
    case 'fixed':
      return FieldType.FIXED
    case 'string':
      return FieldType.STRING
    case 'bytes':
      return FieldType.BYTES
    case 'int':
      return FieldType.INT
    case 'abstract:long':
    case 'long':
      return FieldType.LONG
    case 'float':
      return FieldType.FLOAT
    case 'double':
      return FieldType.DOUBLE
    case 'boolean':
      return FieldType.BOOLEAN
    case 'null':
      return FieldType.NULL
    default:
      return FieldType.NULL
  }
}

function disjoint(slice1: Set<string>, map1: Set<string>): boolean {
  for (const v of slice1) {
    if (map1.has(v)) {
      return false
    }
  }
  return true
}

function resolveUnion(schema: Type, msg: any): [Type | null, any] {
  let unionTypes = null
  if (schema.typeName === 'union:unwrapped') {
    const union = schema as UnwrappedUnionType
    unionTypes = union.types.slice()
    if (unionTypes != null) {
      for (let i = 0; i < unionTypes.length; i++) {
        if (unionTypes[i].isValid(msg)) {
          return [unionTypes[i], msg]
        }
      }
    }
  } else if (schema.typeName === 'union:wrapped') {
    const union = schema as WrappedUnionType
    unionTypes = union.types.slice()
    if (typeof msg === 'object') {
      let keys = Object.keys(msg)
      if (keys.length === 1) {
        let name = keys[0]
        for (let i = 0; i < unionTypes.length; i++) {
          if (unionTypes[i].branchName === name) {
            return [unionTypes[i], msg[name]]
          }
        }
      } else {
        throw new Error('wrapped unions require a name/value pair with the name as the type name')
      }
    }
  }
  return [null, msg]
}

function getInlineTags(info: SchemaInfo, deps: Map<string, string>): Map<string, Set<string>> {
  const inlineTags = new Map<string, Set<string>>()
  getInlineTagsRecursively('', '', JSON.parse(info.schema), inlineTags)
  for (const depSchema of deps.values()) {
    getInlineTagsRecursively('', '', JSON.parse(depSchema), inlineTags)
  }
  return inlineTags
}

// iterate over the object and get all properties named 'confluent:tags'
function getInlineTagsRecursively(ns: string, name: string, schema: any, tags: Map<string, Set<string>>): void {
  if (schema == null || typeof schema === 'string') {
    return
  } else if (Array.isArray(schema)) {
    for (let i = 0; i < schema.length; i++) {
      getInlineTagsRecursively(ns, name, schema[i], tags)
    }
  } else if (typeof schema === 'object') {
    const type = schema['type']
    switch (type) {
      case 'array':
        getInlineTagsRecursively(ns, name, schema['items'], tags)
        break;
      case 'map':
        getInlineTagsRecursively(ns, name, schema['values'], tags)
        break;
      case 'record':
        let recordNs = schema['namespace']
        let recordName = schema['name']
        if (recordNs === undefined) {
          recordNs = impliedNamespace(name)
        }
        if (recordNs == null) {
          recordNs = ns
        }
        if (recordNs !== '' && !recordName.startsWith(recordNs)) {
          recordName = recordNs + '.' + recordName
        }
        const fields = schema['fields']
        for (const field of fields) {
          const fieldTags = field['confluent:tags']
          const fieldName = field['name']
          if (fieldTags !== undefined && fieldName !== undefined) {
            tags.set(recordName + '.' + fieldName, new Set(fieldTags))
          }
          const fieldType = field['type']
          if (fieldType !== undefined) {
            getInlineTagsRecursively(recordNs, recordName, fieldType, tags)
          }
        }
        break;
    }
  }
}

function impliedNamespace(name: string): string | null {
  const match = /^(.*)\.[^.]+$/.exec(name)
  return match ? match[1] : null
}


