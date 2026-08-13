import {
  Deserializer,
  DeserializerConfig,
  evaluateValidationRule,
  FieldTransform,
  FieldType, RuleConditionError,
  RuleContext, SchemaId,
  SerdeType, SerializationError,
  Serializer,
  SerializerConfig,
  ValidationRule, ValidationRuleError, ValidationRuleExecutor, ValidationRulesExecution
} from "./serde";
import {
  Client, Reference, RuleMode, RulePhase,
  SchemaInfo,
  SchemaMetadata
} from "../schemaregistry-client";
import {
  createFileRegistry, createMutableRegistry,
  DescField,
  DescFile,
  DescMessage,
  FileRegistry,
  fromBinary, getExtension, hasExtension, MutableRegistry,
  Registry,
  ScalarType,
  toBinary,
} from "@bufbuild/protobuf";
import {
  file_google_protobuf_any,
  file_google_protobuf_api,
  file_google_protobuf_descriptor,
  file_google_protobuf_duration,
  file_google_protobuf_empty,
  file_google_protobuf_field_mask,
  file_google_protobuf_source_context,
  file_google_protobuf_struct,
  file_google_protobuf_timestamp,
  file_google_protobuf_type,
  file_google_protobuf_wrappers,
  DescriptorProto,
  FieldDescriptorProto,
  FileDescriptorProto,
  FileDescriptorProtoSchema
} from "@bufbuild/protobuf/wkt";
import { LRUCache } from "lru-cache";
import {field_meta, file_confluent_meta, Meta, message_meta, Rule as MetaRule} from "../confluent/meta_pb";
import {RuleRegistry} from "./rule-registry";
import stringify from "json-stringify-deterministic";
import {file_confluent_types_decimal} from "../confluent/types/decimal_pb";
import {file_google_type_calendar_period} from "../google/type/calendar_period_pb";
import {file_google_type_color} from "../google/type/color_pb";
import {file_google_type_date} from "../google/type/date_pb";
import {file_google_type_datetime} from "../google/type/datetime_pb";
import {file_google_type_dayofweek} from "../google/type/dayofweek_pb";
import {file_google_type_fraction} from "../google/type/fraction_pb";
import {file_google_type_expr} from "../google/type/expr_pb";
import {file_google_type_latlng} from "../google/type/latlng_pb";
import {file_google_type_money} from "../google/type/money_pb";
import {file_google_type_postal_address} from "../google/type/postal_address_pb";
import {file_google_type_quaternion} from "../google/type/quaternion_pb";
import {file_google_type_timeofday} from "../google/type/timeofday_pb";
import {file_google_type_month} from "../google/type/month_pb";
import type {IHeaders} from "@confluentinc/kafka-javascript/types/kafkajs";

export const PROTOBUF_TYPE = "PROTOBUF"

const builtinDeps = new Map<string, DescFile>([
  ['confluent/meta.proto',                 file_confluent_meta],
  ['confluent/type/decimal.proto',         file_confluent_types_decimal],
  ['google/type/calendar_period.proto',    file_google_type_calendar_period],
  ['google/type/color.proto',              file_google_type_color],
  ['google/type/date.proto',               file_google_type_date],
  ['google/type/datetime.proto',           file_google_type_datetime],
  ['google/type/dayofweek.proto',          file_google_type_dayofweek],
  ['google/type/expr.proto',               file_google_type_expr],
  ['google/type/fraction.proto',           file_google_type_fraction],
  ['google/type/latlng.proto',             file_google_type_latlng],
  ['google/type/money.proto',              file_google_type_money],
  ['google/type/month.proto',              file_google_type_month],
  ['google/type/postal_address.proto',     file_google_type_postal_address],
  ['google/type/quaternion.proto',         file_google_type_quaternion],
  ['google/type/timeofday.proto',          file_google_type_timeofday],
  ['google/protobuf/any.proto',            file_google_protobuf_any],
  ['google/protobuf/api.proto',            file_google_protobuf_api],
  ['google/protobuf/descriptor.proto',     file_google_protobuf_descriptor],
  ['google/protobuf/duration.proto',       file_google_protobuf_duration],
  ['google/protobuf/empty.proto',          file_google_protobuf_empty],
  ['google/protobuf/field_mask.proto',     file_google_protobuf_field_mask],
  ['google/protobuf/source_context.proto', file_google_protobuf_source_context],
  ['google/protobuf/struct.proto',         file_google_protobuf_struct],
  ['google/protobuf/timestamp.proto',      file_google_protobuf_timestamp],
  ['google/protobuf/type.proto',           file_google_protobuf_type],
  ['google/protobuf/wrappers.proto',       file_google_protobuf_wrappers],
])

export interface ProtobufSerde {
  schemaToDescCache: LRUCache<string, DescFile>
}

/**
 * ProtobufSerializerConfig is the configuration for ProtobufSerializer.
 */
export type ProtobufSerializerConfig = SerializerConfig & {
  registry?: MutableRegistry
}

/**
 * ProtobufSerializer is a serializer for Protobuf messages.
 */
export class ProtobufSerializer extends Serializer implements ProtobufSerde {
  registry: MutableRegistry
  fileRegistry: FileRegistry
  schemaToDescCache: LRUCache<string, DescFile>
  descToSchemaCache: LRUCache<string, SchemaInfo>

  /**
   * Creates a new ProtobufSerializer.
   * @param client - the schema registry client
   * @param serdeType - the serializer type
   * @param conf - the serializer configuration
   * @param ruleRegistry - the rule registry
   */
  constructor(client: Client, serdeType: SerdeType, conf: ProtobufSerializerConfig, ruleRegistry?: RuleRegistry) {
    super(client, serdeType, conf, ruleRegistry)
    this.registry = conf.registry ?? createMutableRegistry()
    this.fileRegistry = createFileRegistry()
    this.schemaToDescCache = new LRUCache<string, DescFile>({ max: this.config().cacheCapacity ?? 1000 } )
    this.descToSchemaCache = new LRUCache<string, SchemaInfo>({ max: this.config().cacheCapacity ?? 1000 } )
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
   * Serializes a message.
   * @param topic - the topic
   * @param msg - the message
   * @param headers - optional headers
   */
  override async serialize(topic: string, msg: any, headers?: IHeaders): Promise<Buffer> {
    if (this.client == null) {
      throw new Error('client is not initialized')
    }
    if (msg == null) {
      throw new Error('message is empty')
    }

    const typeName = msg.$typeName
    if (typeName == null) {
      throw new SerializationError('message type name is empty')
    }
    const messageDesc = this.registry.getMessage(typeName)
    if (messageDesc == null) {
      throw new SerializationError('message descriptor not in registry')
    }

    let schema: SchemaInfo | undefined = undefined
    // Don't derive the schema if it is being looked up in the following ways
    if (this.config().useSchemaId == null &&
      !this.config().useLatestVersion &&
      this.config().useLatestWithMetadata == null) {
      const fileDesc = messageDesc.file
      schema = await this.getSchemaInfo(fileDesc)
    }
    const [schemaId, info] = await this.getSchemaId(PROTOBUF_TYPE, topic, msg, schema, 'serialized')
    const subject = await this.subjectName(topic, info)
    if (this.validationEnabled(ValidationRulesExecution.BEFORE_DOMAIN_RULES)) {
      await this.validateInlineRules(messageDesc, info, msg)
    }
    msg = await this.executeRules(subject, topic, RuleMode.WRITE, null, info, msg, null)
    if (this.validationEnabled(ValidationRulesExecution.AFTER_DOMAIN_RULES)) {
      await this.validateInlineRules(messageDesc, info, msg)
    }
    schemaId.messageIndexes = this.toMessageIndexArray(messageDesc)
    let msgBytes = Buffer.from(toBinary(messageDesc, msg))
    msgBytes = await this.executeRulesWithPhase(
      subject, topic, RulePhase.ENCODING, RuleMode.WRITE, null, info, msgBytes, null)
    return this.serializeSchemaId(topic, msgBytes, schemaId, headers)
  }

  override protoRegistry(): Registry {
    return this.registry
  }

  /**
   * Evaluates the schema's inline validation rules against msg, throwing a single
   * SerializationError listing every violation found.
   *
   * The rules are read from the descriptor parsed out of the schema being written, which
   * is the one carrying the Meta options — the caller's generated descriptor may predate
   * them. Mirrors what fieldTransform does for domain rules. There is deliberately no
   * fallback to the caller's descriptor: see below.
   * @param messageDesc - the caller's message descriptor
   * @param info - the schema being written
   * @param msg - the message to validate
   */
  async validateInlineRules(messageDesc: DescMessage, info: SchemaInfo, msg: any): Promise<void> {
    // Resolving the schema being written is not best-effort: falling back to the caller's
    // descriptor would silently drop any rule the registered schema carries and the
    // generated code does not, letting the message through unchecked. Let the failure
    // abort serialization instead.
    const fileDesc = await this.toFileDesc(this.client, info)
    const desc = this.toMessageDescFromName(fileDesc, messageDesc.typeName)
    const violations = await validateProtobufMessage(
      this.validationRuleExecutor(),
      desc,
      msg,
      Boolean(this.config().validationRulesFailFast),
      // The caller's descriptor names the properties the values live under, which the
      // registered schema may name differently.
      messageDesc)
    this.raiseValidationViolations(violations)
  }

  async getSchemaInfo(fileDesc: DescFile): Promise<SchemaInfo> {
    const value = this.descToSchemaCache.get(fileDesc.name)
    if (value != null) {
      return value
    }
    const deps = this.toProtobufSchema(fileDesc)
    const autoRegister = this.config().autoRegisterSchemas
    const normalize = this.config().normalizeSchemas
    const metadata = await this.resolveDependencies(
      fileDesc, deps, "", Boolean(autoRegister), Boolean(normalize))
    const info = {
      schema: metadata.schema,
      schemaType: metadata.schemaType,
      references: metadata.references,
      metadata: metadata.metadata,
      ruleSet: metadata.ruleSet,
    }
    this.descToSchemaCache.set(fileDesc.name, info)
    return info
  }

  toProtobufSchema(fileDesc: DescFile): Map<string, string> {
    const deps = new Map<string, string>()
    this.toDependencies(fileDesc, deps)
    return deps
  }

  toDependencies(fileDesc: DescFile, deps: Map<string, string>) {
    deps.set(fileDesc.name, Buffer.from(toBinary(FileDescriptorProtoSchema, fileDesc.proto)).toString('base64'))
    fileDesc.dependencies.forEach((dep) => {
      if (!isBuiltin(dep.name)) {
        this.toDependencies(dep, deps)
      }
    })
  }

  async resolveDependencies(fileDesc: DescFile, deps: Map<string, string>, subject: string,
                            autoRegister: boolean, normalize: boolean): Promise<SchemaMetadata> {
    const refs: Reference[] = []
    for (let i = 0; i < fileDesc.dependencies.length; i++) {
      const dep = fileDesc.dependencies[i]
      const depName = dep.name + '.proto'
      if (isBuiltin(depName)) {
        continue
      }
      const ref = await this.resolveDependencies(dep, deps, depName, autoRegister, normalize)
      if (ref == null) {
        throw new SerializationError('dependency not found')
      }
      refs.push({name: depName, subject: ref.subject!, version: ref.version!})
    }
    const info: SchemaInfo = {
      schema: deps.get(fileDesc.name)!,
      schemaType: 'PROTOBUF',
      references: refs
    }
    let id = -1
    let version = 0
    if (subject !== '') {
      if (autoRegister) {
        id = await this.client.register(subject, info, normalize)
      } else {
        id = await this.client.getId(subject, info, normalize)

      }
      version = await this.client.getVersion(subject, info, normalize, false)
    }
    return {
      id: id,
      // TODO verify that guid is not required
      guid: "",
      subject: subject,
      version: version,
      schema: info.schema,
      schemaType: info.schemaType,
      references: info.references,
      metadata: info.metadata,
      ruleSet: info.ruleSet,
    }
  }

  toMessageIndexArray(messageDesc: DescMessage): number[] {
    return this.toMessageIndexes(messageDesc, 0)
  }

  toMessageIndexes(messageDesc: DescMessage, count: number): number[] {
    const index = this.toIndex(messageDesc)
    const parent = messageDesc.parent
    if (parent == null) {
      // parent is FileDescriptor, we reached the top of the stack, so we are
      // done. Allocate an array large enough to hold count+1 entries and
      // populate first value with index
      const msgIndexes: number[] = []
      msgIndexes.push(index)
      return msgIndexes
    } else {
      const msgIndexes = this.toMessageIndexes(parent, count + 1)
      msgIndexes.push(index)
      return msgIndexes
    }
  }

  toIndex(messageDesc: DescMessage) {
    const parent = messageDesc.parent
    if (parent == null) {
      const fileDesc = messageDesc.file
      for (let i = 0; i < fileDesc.messages.length; i++) {
        if (fileDesc.messages[i] === messageDesc) {
          return i
        }
      }
    } else {
      for (let i = 0; i < parent.nestedMessages.length; i++) {
        if (parent.nestedMessages[i] === messageDesc) {
          return i
        }
      }
    }
    throw new SerializationError('message descriptor not found in file descriptor');
  }

  async fieldTransform(ctx: RuleContext, fieldTransform: FieldTransform, msg: any): Promise<any> {
    const fileDesc = await this.toFileDesc(this.client, ctx.target)
    const typeName = msg.$typeName
    const messageDesc = this.toMessageDescFromName(fileDesc, typeName)
    // The registry holds the caller's own descriptor, which names the properties the values
    // live under; the registered schema may name the same fields differently.
    return await transform(ctx, messageDesc, msg, fieldTransform,
      this.registry.getMessage(typeName))
  }

  async toFileDesc(client: Client, info: SchemaInfo): Promise<DescFile> {
    const value = this.schemaToDescCache.get(stringify(info.schema))
    if (value != null) {
      return value
    }
    const fileDesc = await this.parseFileDesc(client, info)
    if (fileDesc == null) {
      throw new SerializationError('file descriptor not found')
    }
    this.schemaToDescCache.set(stringify(info.schema), fileDesc)
    return fileDesc
  }

  async parseFileDesc(client: Client, info: SchemaInfo): Promise<DescFile | undefined> {
    const deps = new Map<string, string>()
    await this.resolveReferences(client, info, deps, 'serialized')
    const fileDesc = fromBinary(FileDescriptorProtoSchema, Buffer.from(info.schema, 'base64'))
    const fileRegistry = newFileRegistry(fileDesc, deps)
    this.fileRegistry = createFileRegistry(this.fileRegistry, fileRegistry)
    return this.fileRegistry.getFile(fileDesc.name)
  }

  toMessageDescFromName(fd: DescFile, msgName: string): DescMessage {
    // Searches nested types too: a nested message is not among the file's top-level
    // messages, and failing to find it here aborts the rule paths that resolve a
    // descriptor from the schema.
    const desc = findMessageDesc(fd, msgName)
    if (desc == null) {
      throw new SerializationError('message descriptor not found')
    }
    return desc
  }

  async getRecordName(info?: SchemaInfo): Promise<string> {
    if (info == null) {
      return ''
    }
    const fileDesc = await this.toFileDesc(this.client, info)
    if (fileDesc.messages.length > 0) {
      return fileDesc.messages[0].typeName.replace(/^\./, '')
    }
    return ''
  }
}

/**
 * ProtobufDeserializerConfig is the configuration for ProtobufDeserializer.
 */
export type ProtobufDeserializerConfig = DeserializerConfig

/**
 * ProtobufDeserializer is a deserializer for Protobuf messages.
 */
export class ProtobufDeserializer extends Deserializer implements ProtobufSerde {
  fileRegistry: FileRegistry
  schemaToDescCache: LRUCache<string, DescFile>

  /**
   * Creates a new ProtobufDeserializer.
   * @param client - the schema registry client
   * @param serdeType - the deserializer type
   * @param conf - the deserializer configuration
   * @param ruleRegistry - the rule registry
   */
  constructor(client: Client, serdeType: SerdeType, conf: ProtobufDeserializerConfig, ruleRegistry?: RuleRegistry) {
    super(client, serdeType, conf, ruleRegistry)
    this.fileRegistry = createFileRegistry()
    this.schemaToDescCache = new LRUCache<string, DescFile>({ max: this.config().cacheCapacity ?? 1000 } )
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

  override protoRegistry(): Registry {
    return this.fileRegistry
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

    const schemaId = new SchemaId(PROTOBUF_TYPE)
    const [info, bytesRead] = await this.getWriterSchema(topic, payload, schemaId, headers, 'serialized')
    payload = payload.subarray(bytesRead)
    const fd = await this.toFileDesc(this.client, info)
    const messageDesc = this.toMessageDescFromIndexes(fd, schemaId.messageIndexes!)

    const subject = await this.subjectName(topic, info)
    payload = await this.executeRulesWithPhase(
      subject, topic, RulePhase.ENCODING, RuleMode.READ, null, info, payload, null)
    const readerMeta = await this.getReaderSchema(subject, 'serialized')

    const msgBytes = payload
    let msg = fromBinary(messageDesc, msgBytes)

    // Currently JavaScript does not support migration rules
    // because of lack of support for DynamicMessage
    let target: SchemaInfo
    if (readerMeta != null) {
      target = readerMeta
    } else {
      target = info
    }
    msg = await this.executeRules(subject, topic, RuleMode.READ, null, target, msg, null)
    return msg
  }

  async fieldTransform(ctx: RuleContext, fieldTransform: FieldTransform, msg: any): Promise<any> {
    const fileDesc = await this.toFileDesc(this.client, ctx.target)
    const typeName = msg.$typeName
    const messageDesc = this.toMessageDescFromName(fileDesc, typeName)
    // No runtime descriptor here: the deserializer builds the message from the
    // schema-derived descriptor, so the properties already carry the schema's names.
    return await transform(ctx, messageDesc, msg, fieldTransform)
  }

  async toFileDesc(client: Client, info: SchemaInfo): Promise<DescFile> {
    const value = this.schemaToDescCache.get(stringify(info.schema))
    if (value != null) {
      return value
    }
    const fileDesc = await this.parseFileDesc(client, info)
    if (fileDesc == null) {
      throw new SerializationError('file descriptor not found')
    }
    this.schemaToDescCache.set(stringify(info.schema), fileDesc)
    return fileDesc
  }

  async parseFileDesc(client: Client, info: SchemaInfo): Promise<DescFile | undefined> {
    const deps = new Map<string, string>()
    await this.resolveReferences(client, info, deps, 'serialized')
    const fileDesc = fromBinary(FileDescriptorProtoSchema, Buffer.from(info.schema, 'base64'))
    const fileRegistry = newFileRegistry(fileDesc, deps)
    this.fileRegistry = createFileRegistry(this.fileRegistry, fileRegistry)
    return this.fileRegistry.getFile(fileDesc.name)
  }

  toMessageDescFromName(fd: DescFile, msgName: string): DescMessage {
    // Searches nested types too: a nested message is not among the file's top-level
    // messages, and failing to find it here aborts the rule paths that resolve a
    // descriptor from the schema.
    const desc = findMessageDesc(fd, msgName)
    if (desc == null) {
      throw new SerializationError('message descriptor not found')
    }
    return desc
  }

  toMessageDescFromIndexes(fd: DescFile, msgIndexes: number[]): DescMessage {
    let index = msgIndexes[0]
    if (index < 0 || index >= fd.messages.length) {
      throw new SerializationError(
        `message index ${index} out of range, schema has ${fd.messages.length} top-level message(s)`)
    }
    if (msgIndexes.length === 1) {
      return fd.messages[index]
    }
    return this.toNestedMessageDesc(fd.messages[index], msgIndexes.slice(1))
  }

  toNestedMessageDesc(parent: DescMessage, msgIndexes: number[]): DescMessage {
    let index = msgIndexes[0]
    if (index < 0 || index >= parent.nestedMessages.length) {
      throw new SerializationError(
        `message index ${index} out of range, message has ${parent.nestedMessages.length} nested message(s)`)
    }
    if (msgIndexes.length === 1) {
      return parent.nestedMessages[index]
    }
    return this.toNestedMessageDesc(parent.nestedMessages[index], msgIndexes.slice(1))
  }

  async getRecordName(info?: SchemaInfo): Promise<string> {
    if (info == null) {
      return ''
    }
    const fileDesc = await this.toFileDesc(this.client, info)
    if (fileDesc.messages.length > 0) {
      return fileDesc.messages[0].typeName.replace(/^\./, '')
    }
    return ''
  }
}

function newFileRegistry(fileDesc: FileDescriptorProto, deps: Map<string, string>): FileRegistry {
  fullyQualifyTypeNames(fileDesc)
  const resolve = (depName: string) => {
    if (isBuiltin(depName)) {
      const dep = builtinDeps.get(depName)
      if (dep == null) {
        throw new SerializationError(`dependency ${depName} not found`)
      }
      return dep
    } else {
      const dep = deps.get(depName)
      if (dep == null) {
        throw new SerializationError(`dependency ${depName} not found`)
      }
      const fileDesc = fromBinary(FileDescriptorProtoSchema, Buffer.from(dep, 'base64'))
      fileDesc.name = depName
      fullyQualifyTypeNames(fileDesc)
      return fileDesc
    }
  }
  return createFileRegistry(fileDesc, resolve)
}

/**
 * Fully qualifies relative type_name references in a FileDescriptorProto.
 * The schema registry may return FileDescriptorProto with relative type names
 * (e.g., "MyEnum" instead of ".test.MyEnum"), which createFileRegistry cannot resolve.
 */
function fullyQualifyTypeNames(fileDesc: FileDescriptorProto): void {
  const prefix = fileDesc.package ? `.${fileDesc.package}` : ''

  const allTypes = new Set<string>()
  for (const enumProto of fileDesc.enumType) {
    allTypes.add(`${prefix}.${enumProto.name}`)
  }
  for (const msgProto of fileDesc.messageType) {
    collectTypes(msgProto, prefix, allTypes)
  }

  for (const msgProto of fileDesc.messageType) {
    resolveFieldTypeNames(msgProto, prefix, allTypes)
  }
  for (const extProto of fileDesc.extension) {
    resolveTypeName(extProto, prefix, allTypes)
  }
}

function collectTypes(
  msg: DescriptorProto, parentScope: string, allTypes: Set<string>
): void {
  const scope = `${parentScope}.${msg.name}`
  allTypes.add(scope)
  for (const enumProto of msg.enumType) {
    allTypes.add(`${scope}.${enumProto.name}`)
  }
  for (const nestedMsg of msg.nestedType) {
    collectTypes(nestedMsg, scope, allTypes)
  }
}

function resolveFieldTypeNames(
  msg: DescriptorProto, parentScope: string, allTypes: Set<string>
): void {
  const scope = `${parentScope}.${msg.name}`
  for (const field of msg.field) {
    resolveTypeName(field, scope, allTypes)
  }
  for (const ext of msg.extension) {
    resolveTypeName(ext, scope, allTypes)
  }
  for (const nestedMsg of msg.nestedType) {
    resolveFieldTypeNames(nestedMsg, scope, allTypes)
  }
}

function resolveTypeName(
  field: FieldDescriptorProto, scope: string, allTypes: Set<string>
): void {
  if (!field.typeName || field.typeName.startsWith('.')) {
    return
  }
  let currentScope = scope
  while (currentScope !== '') {
    const candidate = `${currentScope}.${field.typeName}`
    if (allTypes.has(candidate)) {
      field.typeName = candidate
      return
    }
    const lastDot = currentScope.lastIndexOf('.')
    currentScope = lastDot >= 0 ? currentScope.substring(0, lastDot) : ''
  }
  const rootCandidate = `.${field.typeName}`
  if (allTypes.has(rootCandidate)) {
    field.typeName = rootCandidate
  } else if (field.typeName.includes('.')) {
    // Cross-file reference that is package-qualified but missing the leading dot.
    // Prefix with '.' so createFileRegistry can resolve it via dependencies.
    field.typeName = rootCandidate
  }
}

export async function transform(ctx: RuleContext, descriptor: DescMessage, msg: any,
                                fieldTransform: FieldTransform,
                                runtimeDescriptor?: DescMessage): Promise<any> {
  if (msg == null || descriptor == null) {
    return msg
  }
  if (msg.$typeName != null) {
    // Driven by the message's own fields when the runtime descriptor is known, each paired
    // to the schema field by number - see schemaFieldFor.
    for (const runtimeFd of (runtimeDescriptor ?? descriptor).fields) {
      const fd = schemaFieldFor(descriptor, runtimeDescriptor, runtimeFd)
      if (fd == null) {
        // The schema does not declare this field, so it carries no tags.
        continue
      }
      await transformField(ctx, fd, runtimeFd, descriptor, msg, fieldTransform)
    }
    return msg
  }
  return await transformLeaf(ctx, msg, fieldTransform)
}

async function transformField(ctx: RuleContext, fd: DescField, runtimeFd: DescField,
                              desc: DescMessage, msg: any, fieldTransform: FieldTransform) {
  try {
    // Names and tags come from the schema-side field - rules and metadata tags are written
    // against the registered schema; the value is read through the runtime one.
    ctx.enterField(
      msg,
      desc.typeName + '.' + fd.name,
      fd.name,
      getType(runtimeFd),
      getInlineTags(fd),
      isUnsignedField(runtimeFd)
    )
    let value = null;
    if (runtimeFd.oneof != null) {
      let oneof = msg[runtimeFd.oneof.localName]
      if (oneof != null && oneof.case === runtimeFd.localName) {
        value = oneof.value
      } else {
        // skip oneof fields that are not set
        return
      }
    } else {
      value = msg[runtimeFd.localName]
    }
    const newValue = await transformFieldValue(ctx, fd, runtimeFd, value, fieldTransform)
    if (ctx.rule.kind === 'CONDITION') {
      if (newValue === false) {
        throw new RuleConditionError(ctx.rule)
      }
    } else {
      if (runtimeFd.oneof != null) {
        msg[runtimeFd.oneof.localName] = { case: runtimeFd.localName, value: newValue }
      } else {
        msg[runtimeFd.localName] = newValue
      }
    }
  } finally {
    ctx.leaveField()
  }
}

/**
 * Transforms one field's value, descending exactly the way the validation walk does: into a
 * message-valued field with that field's own descriptor, into every element of a repeated
 * field, and into every value of a message-valued map. Anything else is a leaf and goes to
 * the field transform.
 */
async function transformFieldValue(ctx: RuleContext, fd: DescField, runtimeFd: DescField,
                                   value: any,
                                   fieldTransform: FieldTransform): Promise<any> {
  if (value == null) {
    return value
  }
  // The nested walk needs both descriptors again: the schema's for tags and names, the
  // runtime's for the properties the values live under.
  const nestedRuntime = runtimeFd.fieldKind === 'message'
    || (runtimeFd.fieldKind === 'list' && runtimeFd.listKind === 'message')
    || (runtimeFd.fieldKind === 'map' && runtimeFd.mapKind === 'message')
    ? runtimeFd.message
    : undefined
  if (fd.fieldKind === 'message') {
    return await transform(ctx, fd.message, value, fieldTransform, nestedRuntime)
  }
  if (fd.fieldKind === 'list') {
    if (!Array.isArray(value)) {
      return value
    }
    const result: any[] = []
    for (const element of value) {
      result.push(fd.listKind === 'message'
        ? await transform(ctx, fd.message, element, fieldTransform, nestedRuntime)
        : await transformLeaf(ctx, element, fieldTransform))
    }
    return result
  }
  if (fd.fieldKind === 'map') {
    if (typeof value !== 'object' || fd.mapKind !== 'message') {
      // A map of scalars has no tags below it to act on, which is also why the validation
      // walk does not descend into one.
      return value
    }
    const result: Record<string, any> = {}
    for (const [key, entry] of Object.entries(value)) {
      result[key] = await transform(ctx, fd.message, entry, fieldTransform, nestedRuntime)
    }
    return result
  }
  return await transformLeaf(ctx, value, fieldTransform)
}

/**
 * Hands a leaf value to the field transform, when the rule's tags overlap the field's.
 */
async function transformLeaf(ctx: RuleContext, value: any,
                             fieldTransform: FieldTransform): Promise<any> {
  const fieldCtx = ctx.currentField()
  if (fieldCtx == null) {
    return value
  }
  const ruleTags = ctx.rule.tags ?? []
  if (ruleTags.length !== 0 && disjoint(new Set<string>(ruleTags), fieldCtx.tags)) {
    return value
  }
  return await fieldTransform.transform(ctx, fieldCtx, value)
}

/**
 * Whether a field's declared type is an unsigned integer. getType collapses these onto INT
 * and LONG, so the unsignedness has to travel separately for a rule to see the value as the
 * other clients do.
 */
function isUnsignedField(fd: DescField): boolean {
  const scalar = fd.fieldKind === 'scalar' ? fd.scalar
    : fd.fieldKind === 'list' && fd.listKind === 'scalar' ? fd.scalar
      : undefined
  return scalar === ScalarType.UINT32 || scalar === ScalarType.UINT64
    || scalar === ScalarType.FIXED32 || scalar === ScalarType.FIXED64
}

function getType(fd: DescField): FieldType {
  let kind = fd.fieldKind
  if (fd.fieldKind === 'list') {
    kind = fd.listKind
  }
  switch (kind) {
    case 'map':
      return FieldType.MAP
    case 'message':
      return FieldType.RECORD
    case 'enum':
      return FieldType.ENUM
    case 'scalar':
      switch (fd.scalar) {
        case ScalarType.STRING:
          return FieldType.STRING
        case ScalarType.BYTES:
          return FieldType.BYTES
        case ScalarType.INT32:
        case ScalarType.SINT32:
        case ScalarType.UINT32:
        case ScalarType.FIXED32:
        case ScalarType.SFIXED32:
          return FieldType.INT
        case ScalarType.INT64:
        case ScalarType.SINT64:
        case ScalarType.UINT64:
        case ScalarType.FIXED64:
        case ScalarType.SFIXED64:
          return FieldType.LONG
        case ScalarType.FLOAT:
          return FieldType.FLOAT
        case ScalarType.DOUBLE:
          return FieldType.DOUBLE
        case ScalarType.BOOL:
          return FieldType.BOOLEAN
        default:
          return FieldType.NULL
      }
    default:
      return FieldType.NULL
  }
}

/**
 * Walks msg against descriptor, evaluating every inline validation rule declared in the
 * `confluent.Meta` extension and collecting all failures. Read-only — the message is not
 * modified.
 *
 * Two kinds of rules are evaluated:
 * - Message-level (`confluent.message_meta` rules) — `this` is the message.
 * - Field-level (`confluent.field_meta` rules) — `this` is the field value; for repeated
 *   and map fields that is the whole collection. Honors the skip-on-null contract: a
 *   field that is unset (proto3 `optional`, singular message fields, oneof members) does
 *   not have its rules invoked.
 *
 * Failures are returned with their dotted-path location (e.g. `addr.zip`, `items[3]`,
 * `labels["k"]`). The walk continues after each failure unless failFast is set.
 *
 * Only `message_meta` and `field_meta` rules are evaluated; rules on files, enums and
 * enum values are ignored, matching the JVM client.
 * @param executor - the validation rule executor
 * @param descriptor - the message descriptor to walk
 * @param msg - the message to validate
 * @param failFast - whether to stop at the first violation
 */
/**
 * Finds a message descriptor by fully qualified name anywhere in a file, including nested
 * types. Unlike toMessageDescFromName, which scans only top-level messages, this is used
 * where a miss has to be distinguishable from "the type is nested".
 */
function findMessageDesc(fileDesc: DescFile, typeName: string): DescMessage | undefined {
  const search = (messages: readonly DescMessage[]): DescMessage | undefined => {
    for (const message of messages) {
      if (message.typeName === typeName) {
        return message
      }
      const nested = search(message.nestedMessages)
      if (nested != null) {
        return nested
      }
    }
    return undefined
  }
  return search(fileDesc.messages)
}

export async function validateProtobufMessage(
  executor: ValidationRuleExecutor,
  descriptor: DescMessage,
  msg: any,
  failFast: boolean,
  runtimeDescriptor?: DescMessage,
): Promise<ValidationRuleError[]> {
  const out: ValidationRuleError[] = []
  if (executor == null || descriptor == null || msg == null) {
    return out
  }
  // The walk is driven by the caller's message throughout: it decides which fields exist,
  // which are absent, and what the values are. A rule that binds `this` to a message needs
  // one more thing - a view of that message in the schema's terms, since a rule's CEL
  // environment is built from the schema and `this.renamed` cannot read a field the caller's
  // type calls something else. Protobuf pairs fields by number on the wire, so re-reading the
  // message through the registered descriptor produces exactly that view.
  //
  // Whether that is needed is decided once per descriptor pair (see needsSchemaView) rather
  // than per record. A generated type describing the same fields as the registered schema
  // skips it entirely, even though the two descriptors are distinct objects. A type that has
  // fallen behind the schema does not: under use.latest.version the schema may declare a
  // field the type has never heard of, and a rule that binds `this` can read the schema's
  // default for it, so those producers re-read every record. That cost is the price of
  // evaluating rules in the schema's terms, not an accident.
  let schemaMsg: any = undefined
  if (runtimeDescriptor != null && needsSchemaView(descriptor, runtimeDescriptor)) {
    try {
      schemaMsg = fromBinary(descriptor, toBinary(runtimeDescriptor, msg))
    } catch (e) {
      // The bytes the producer is about to write cannot be read through the registered
      // schema, so a consumer reading with that schema could not read them either - a bytes
      // field carrying non-UTF-8 data against a schema that declares a string, for instance,
      // which is a compatible change. Fail in the channel the caller already handles rather
      // than leaking a raw protobuf error, and name the type so it is searchable.
      throw new SerializationError(
        `could not read message ${descriptor.typeName} through the registered schema: `
        + `${e instanceof Error ? e.message : String(e)}`)
    }
  }
  await validate(executor, descriptor, runtimeDescriptor ?? descriptor, '', msg, schemaMsg,
    failFast, out)
  return out
}

// Memoizes needsSchemaView, keyed by the registered schema's descriptor and then the runtime
// one. Both are stable for the lifetime of a serializer, so this is one lookup per record
// rather than a tree comparison.
const schemaViewNeeded = new WeakMap<DescMessage, WeakMap<DescMessage, boolean>>()

/**
 * Whether a message whose runtime descriptor is runtimeDescriptor has to be re-read through
 * descriptor before rules can bind `this` to it - true when the two disagree about any field
 * a rule could observe: its name, its kind, or the shape of its values, at any depth.
 *
 * Presence deliberately does not count. Whether an unset field is absent is decided by the
 * producer's message, which the walk reads directly, so a schema that only moved a field into
 * or out of a oneof needs no re-read.
 *
 * A field the schema declares and the caller's type does not does count, which means a type
 * running behind the registered schema - the use.latest.version case - re-reads every record.
 * Only an exact match skips the re-read. Narrowing that to the rules that could actually
 * observe the added field is possible but not simple: a rule binding `this` at any ancestor
 * can traverse into the field, and a field-level rule on a message-valued field binds `this`
 * to a type that need not declare rules of its own, so a per-descriptor test for
 * message-level rules would be wrong in both directions.
 */
function needsSchemaView(descriptor: DescMessage, runtimeDescriptor: DescMessage): boolean {
  if (runtimeDescriptor === descriptor) {
    return false
  }
  let byRuntime = schemaViewNeeded.get(descriptor)
  if (byRuntime == null) {
    byRuntime = new WeakMap<DescMessage, boolean>()
    schemaViewNeeded.set(descriptor, byRuntime)
  }
  const cached = byRuntime.get(runtimeDescriptor)
  if (cached != null) {
    return cached
  }
  const needed = !presentsSameValues(descriptor, runtimeDescriptor, new Set<string>())
  byRuntime.set(runtimeDescriptor, needed)
  return needed
}

/**
 * Whether the two descriptors present every field they share - paired by number, which is how
 * protobuf identifies a field - under the same name, kind and value shape, recursively through
 * message-valued fields. Fields only the caller declares are ignored: no rule can name them,
 * and the walk skips them.
 *
 * visited holds the descriptor pairs already compared, so a self-referential message type
 * terminates.
 */
function presentsSameValues(descriptor: DescMessage, runtimeDescriptor: DescMessage,
                            visited: Set<string>): boolean {
  const pair = `${descriptor.typeName}\0${runtimeDescriptor.typeName}`
  if (visited.has(pair)) {
    // Already compared on another path, or cycling back to it. Either way this pair
    // contributes no new disagreement.
    return true
  }
  visited.add(pair)
  for (const schemaFd of descriptor.fields) {
    if (runtimeDescriptor.fields.find((f) => f.number === schemaFd.number) == null) {
      return false
    }
  }
  for (const runtimeFd of runtimeDescriptor.fields) {
    const schemaFd = descriptor.fields.find((f) => f.number === runtimeFd.number)
    if (schemaFd == null) {
      continue
    }
    if (schemaFd.name !== runtimeFd.name || schemaFd.fieldKind !== runtimeFd.fieldKind) {
      return false
    }
    switch (runtimeFd.fieldKind) {
      case 'scalar':
        if (schemaFd.fieldKind !== 'scalar' || schemaFd.scalar !== runtimeFd.scalar) {
          return false
        }
        break
      case 'message':
        if (schemaFd.fieldKind !== 'message'
          || !presentsSameValues(schemaFd.message, runtimeFd.message, visited)) {
          return false
        }
        break
      case 'list':
        if (schemaFd.fieldKind !== 'list' || schemaFd.listKind !== runtimeFd.listKind) {
          return false
        }
        if (runtimeFd.listKind === 'scalar' && schemaFd.listKind === 'scalar'
          && schemaFd.scalar !== runtimeFd.scalar) {
          return false
        }
        if (runtimeFd.listKind === 'message' && schemaFd.listKind === 'message'
          && !presentsSameValues(schemaFd.message, runtimeFd.message, visited)) {
          return false
        }
        break
      case 'map':
        if (schemaFd.fieldKind !== 'map' || schemaFd.mapKind !== runtimeFd.mapKind
          || schemaFd.mapKey !== runtimeFd.mapKey) {
          return false
        }
        if (runtimeFd.mapKind === 'scalar' && schemaFd.mapKind === 'scalar'
          && schemaFd.scalar !== runtimeFd.scalar) {
          return false
        }
        if (runtimeFd.mapKind === 'message' && schemaFd.mapKind === 'message'
          && !presentsSameValues(schemaFd.message, runtimeFd.message, visited)) {
          return false
        }
        break
      default:
        break
    }
  }
  return true
}

/**
 * The value a field holds on a message, or undefined when it is absent. A oneof member lives
 * under its oneof's property and is present only when that oneof selects it.
 */
function readField(msg: any, fd: DescField): any {
  if (fd.oneof != null) {
    const oneof = msg[fd.oneof.localName]
    if (oneof == null || oneof.case !== fd.localName) {
      return undefined
    }
    return oneof.value
  }
  return msg[fd.localName]
}

/**
 * Mirrors transform's dispatch shape, walking the descriptor's fields and descending
 * into message-valued fields, map values and repeated elements.
 */
async function validate(
  executor: ValidationRuleExecutor,
  descriptor: DescMessage,
  runtimeDescriptor: DescMessage,
  path: string,
  msg: any,
  schemaMsg: any,
  failFast: boolean,
  out: ValidationRuleError[],
): Promise<void> {
  if (descriptor == null || msg == null || msg.$typeName == null) {
    return
  }
  // Message-level rules: this = the message, read as the schema names it.
  for (const rule of getMessageValidationRules(descriptor)) {
    await evaluateValidationRule(executor, rule, descriptor, schemaMsg ?? msg, path, out)
    if (failFast && out.length > 0) {
      return
    }
  }
  // The walk is driven by the caller's message: it decides which fields exist, which are
  // absent, and what the values are. Each field is paired to the registered schema by number,
  // and the schema's field supplies the rules and the name used in the reported path. Fields
  // the schema does not declare are skipped, so the walk visits the intersection - the same
  // fields the transform walk visits.
  for (const runtimeFd of runtimeDescriptor.fields) {
    const fd = schemaFieldFor(descriptor, runtimeDescriptor, runtimeFd)
    if (fd == null) {
      continue
    }
    const value = readField(msg, runtimeFd)
    // Skip-on-null: a field with explicit presence that is unset does not invoke the
    // executor. Repeated/map fields are always present as an empty collection.
    //
    // Absence is read from the caller's message: whether an unset field counts as absent is
    // decided by the type that wrote it, not by the registered schema, and the two can
    // disagree - moving a field into or out of a oneof is a compatible change.
    if (value == null) {
      continue
    }
    // Where a schema view exists, values come from it: the two descriptors can disagree about
    // representation as well as naming. bytes and string are interchangeable at the same
    // number - a compatible change - and a rule authored as `this == 'hello'` cannot match a
    // Uint8Array.
    const schemaValue = schemaMsg != null ? readField(schemaMsg, fd) : undefined
    const ruleValue = schemaValue !== undefined ? schemaValue : value
    // Paths come from the registered schema, which is what a rule refers to.
    const childPath = path ? `${path}.${fd.name}` : fd.name
    for (const rule of getFieldValidationRules(fd)) {
      await evaluateValidationRule(executor, rule, fd, ruleValue, childPath, out)
      if (failFast && out.length > 0) {
        return
      }
    }
    if (runtimeFd.fieldKind === 'message' && fd.fieldKind === 'message') {
      await validate(executor, fd.message, runtimeFd.message, childPath, value, schemaValue,
        failFast, out)
      if (failFast && out.length > 0) {
        return
      }
    } else if (runtimeFd.fieldKind === 'list' && runtimeFd.listKind === 'message'
      && fd.fieldKind === 'list' && fd.listKind === 'message') {
      for (let i = 0; i < value.length; i++) {
        // Both lists came from the same bytes, so they line up; the guard is for safety.
        const schemaElement = Array.isArray(schemaValue) && i < schemaValue.length
          ? schemaValue[i] : undefined
        await validate(executor, fd.message, runtimeFd.message, `${childPath}[${i}]`, value[i],
          schemaElement, failFast, out)
        if (failFast && out.length > 0) {
          return
        }
      }
    } else if (runtimeFd.fieldKind === 'map' && runtimeFd.mapKind === 'message'
      && fd.fieldKind === 'map' && fd.mapKind === 'message') {
      for (const key of Object.keys(value)) {
        // Map values pair by key rather than position.
        const schemaEntry = schemaValue != null ? schemaValue[key] : undefined
        await validate(executor, fd.message, runtimeFd.message, `${childPath}["${key}"]`,
          value[key], schemaEntry, failFast, out)
        if (failFast && out.length > 0) {
          return
        }
      }
    }
  }
}

/**
 * The schema-side field corresponding to a runtime field, paired by number. When no runtime
 * descriptor is supplied the two are the same descriptor and the field is returned as is.
 */
function schemaFieldFor(descriptor: DescMessage, runtimeDescriptor: DescMessage | undefined,
                        runtimeFd: DescField): DescField | undefined {
  if (runtimeDescriptor == null) {
    return runtimeFd
  }
  return descriptor.fields.find((f) => f.number === runtimeFd.number)
}

function getMessageValidationRules(desc: DescMessage): ValidationRule[] {
  const options = desc.proto.options
  if (options != null && hasExtension(options, message_meta)) {
    const meta: Meta = getExtension(options, message_meta)
    return toValidationRules(meta.rules)
  }
  return []
}

function getFieldValidationRules(fd: DescField): ValidationRule[] {
  const options = fd.proto.options
  if (options != null && hasExtension(options, field_meta)) {
    const meta: Meta = getExtension(options, field_meta)
    return toValidationRules(meta.rules)
  }
  return []
}

function toValidationRules(rules: MetaRule[]): ValidationRule[] {
  return rules.map(r => ({ name: r.name, doc: r.doc, expr: r.expr, sql: r.sql }))
}

function getInlineTags(fd: DescField): Set<string> {
  const options = fd.proto.options
  if (options != null && hasExtension(options, field_meta)) {
    const option: Meta = getExtension(options, field_meta)
    return new Set<string>(option.tags)
  }
  return new Set<string>()
}

function disjoint(tags1: Set<string>, tags2: Set<string>): boolean {
  for (let tag of tags1) {
    if (tags2.has(tag)) {
      return false
    }
  }
  return true
}

function isBuiltin(name: string): boolean {
  return name.startsWith('confluent/') ||
    name.startsWith('google/protobuf/') ||
    name.startsWith('google/type/')
}
