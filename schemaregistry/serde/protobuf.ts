import {
  Deserializer,
  DeserializerConfig,
  FieldTransform,
  FieldType, RuleConditionError,
  RuleContext,
  SerdeType, SerializationError,
  Serializer,
  SerializerConfig
} from "./serde";
import {
  Client, Reference, RuleMode,
  SchemaInfo,
  SchemaMetadata
} from "../schemaregistry-client";
import {
  createFileRegistry,
  DescField,
  DescFile,
  DescMessage,
  FileRegistry,
  fromBinary, getExtension, hasExtension,
  Registry,
  ScalarType,
  toBinary
} from "@bufbuild/protobuf";
import { FileDescriptorProtoSchema } from "@bufbuild/protobuf/wkt";
import { BufferWrapper, MAX_VARINT_LEN_64 } from "./buffer-wrapper";
import { LRUCache } from "lru-cache";
import {field_meta, Meta} from "../confluent/meta_pb";
import {getRuleExecutors} from "./rule-registry";
import stringify from "json-stringify-deterministic";

export interface ProtobufSerde {
  schemaToDescCache: LRUCache<string, DescFile>
}

export type ProtobufSerializerConfig = SerializerConfig & {
  registry: Registry
  descToSchemaCache: LRUCache<string, SchemaInfo>
}

export class ProtobufSerializer extends Serializer implements ProtobufSerde {
  registry: Registry
  schemaToDescCache: LRUCache<string, DescFile>
  descToSchemaCache: LRUCache<string, SchemaInfo>

  constructor(client: Client, serdeType: SerdeType, conf: ProtobufSerializerConfig) {
    super(client, serdeType, conf)
    this.registry = conf.registry
    this.schemaToDescCache = new LRUCache<string, DescFile>({ max: this.config().cacheCapacity ?? 1000 } )
    this.descToSchemaCache = new LRUCache<string, SchemaInfo>({ max: this.config().cacheCapacity ?? 1000 } )
    this.fieldTransformer = async (ctx: RuleContext, fieldTransform: FieldTransform, msg: any) => {
      return await this.fieldTransform(ctx, fieldTransform, msg)
    }
    for (const rule of getRuleExecutors()) {
      rule.configure(client.config(), new Map<string, string>(Object.entries(conf.ruleConfig ?? {})))
    }
  }

  async serialize(topic: string, msg: any): Promise<Buffer> {
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
    const fileDesc = messageDesc.file
    const schema = await this.getSchemaInfo(fileDesc)
    const [id, info] = await this.getId(topic, msg, schema)
    const subject = this.subjectName(topic, info)
    msg = await this.executeRules(subject, topic, RuleMode.WRITE, null, info, msg, null)
    const msgIndexBytes = this.toMessageIndexBytes(messageDesc)
    const msgBytes = Buffer.from(toBinary(messageDesc, msg))
    return this.writeBytes(id, Buffer.concat([msgIndexBytes, msgBytes]))
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
      if (!this.ignoreFile(dep.name)) {
        this.toDependencies(dep, deps)
      }
    })
  }

  async resolveDependencies(fileDesc: DescFile, deps: Map<string, string>, subject: string,
                            autoRegister: boolean, normalize: boolean): Promise<SchemaMetadata> {
    const refs: Reference[] = []
    refs.length = fileDesc.dependencies.length
    for (let i = 0; i < fileDesc.dependencies.length; i++) {
      const dep = fileDesc.dependencies[i]
      if (this.ignoreFile(dep.name)) {
        continue
      }
      const ref = await this.resolveDependencies(dep, deps, dep.name, autoRegister, normalize)
      if (ref == null) {
        throw new SerializationError('dependency not found')
      }
      refs.push({name: dep.name, subject: ref.subject!, version: ref.version!})
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
      version = await this.client.getVersion(subject, info, normalize)
    }
    return {
      id: id,
      subject: subject,
      version: version,
      schema: info.schema,
      schemaType: info.schemaType,
      references: info.references,
      metadata: info.metadata,
      ruleSet: info.ruleSet,
    }
  }

  toMessageIndexBytes(messageDesc: DescMessage): Buffer {
    const msgIndexes: number[] = this.toMessageIndexes(messageDesc, 0)
    const buffer = Buffer.alloc((1 + msgIndexes.length) * MAX_VARINT_LEN_64)
    const bw = new BufferWrapper(buffer)
    bw.writeVarInt(msgIndexes.length)
    for (let i = 0; i < msgIndexes.length; i++) {
      bw.writeVarInt(msgIndexes[i])
    }
    return buffer.subarray(0, bw.pos)
  }

  toMessageIndexes(messageDesc: DescMessage, count: number): number[] {
    const index = this.toIndex(messageDesc)
    const parent = messageDesc.parent
    if (parent == null) {
      // parent is FileDescriptor, we reached the top of the stack, so we are
      // done. Allocate an array large enough to hold count+1 entries and
      // populate first value with index
      const msgIndexes: number[] = []
      msgIndexes.length = count + 1
      msgIndexes[0] = index
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

  ignoreFile(name: string): boolean {
    return name.startsWith('confluent/') ||
      name.startsWith('google/protobuf/') ||
      name.startsWith('google/type/')
  }

  async fieldTransform(ctx: RuleContext, fieldTransform: FieldTransform, msg: any): Promise<any> {
    const typeName = msg.$typeName
    if (typeName == null) {
      throw new SerializationError('message type name is empty')
    }
    const messageDesc = this.registry.getMessage(typeName)
    if (messageDesc == null) {
      throw new SerializationError('message descriptor not in registry')
    }
    return await transform(ctx, messageDesc, msg, fieldTransform)
  }
}

export type ProtobufDeserializerConfig = DeserializerConfig

export class ProtobufDeserializer extends Deserializer implements ProtobufSerde {
  registry: FileRegistry
  schemaToDescCache: LRUCache<string, DescFile>

  constructor(client: Client, serdeType: SerdeType, conf: ProtobufDeserializerConfig) {
    super(client, serdeType, conf)
    this.registry = createFileRegistry()
    this.schemaToDescCache = new LRUCache<string, DescFile>({ max: this.config().cacheCapacity ?? 1000 } )
    this.fieldTransformer = async (ctx: RuleContext, fieldTransform: FieldTransform, msg: any) => {
      return await this.fieldTransform(ctx, fieldTransform, msg)
    }
    for (const rule of getRuleExecutors()) {
      rule.configure(client.config(), new Map<string, string>(Object.entries(conf.ruleConfig ?? {})))
    }
  }

  async deserialize(topic: string, payload: Buffer): Promise<any> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('Invalid buffer')
    }
    if (payload.length === 0) {
      return null
    }

    const info = await this.getSchema(topic, payload)
    const fd = await this.toFileDesc(this.client, info)
    const [bytesRead, msgIndexes] = this.readMessageIndexes(payload.subarray(5))
    const messageDesc = this.toMessageDesc(fd, msgIndexes)

    const subject = this.subjectName(topic, info)
    const readerMeta = await this.getReaderSchema(subject)

    const msgBytes = payload.subarray(5 + bytesRead)
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
    const typeName = msg.$typeName
    if (typeName == null) {
      throw new SerializationError('message type name is empty')
    }
    const messageDesc = this.registry.getMessage(typeName)
    if (messageDesc == null) {
      throw new SerializationError('message descriptor not in registry')
    }
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
    await this.resolveReferences(client, info, deps)
    const fileDesc = fromBinary(FileDescriptorProtoSchema, Buffer.from(info.schema, 'base64'))
    const resolve = (depName: string) => {
      const dep = deps.get(depName)
      if (dep == null) {
        throw new SerializationError('dependency not found')
      }
      return fromBinary(FileDescriptorProtoSchema, Buffer.from(dep, 'base64'))
    }
    // TODO check google protos already in registry
    const fileRegistry = createFileRegistry(fileDesc, resolve)
    this.registry = createFileRegistry(this.registry, fileRegistry)
    return this.registry.getFile(fileDesc.name)
  }

  readMessageIndexes(payload: Buffer): [number, number[]] {
    const bw = new BufferWrapper(payload)
    const count = bw.readVarInt()
    const msgIndexes = []
    msgIndexes.length = count
    for (let i = 0; i < count; i++) {
      msgIndexes[i] = bw.readVarInt()
    }
    return [bw.pos, msgIndexes]
  }

  toMessageDesc(fd: DescFile, msgIndexes: number[]): DescMessage {
    let index = msgIndexes[0]
    if (msgIndexes.length === 1) {
      return fd.messages[index]
    }
    return this.toNestedMessageDesc(fd.messages[index], msgIndexes.slice(1))
  }

  toNestedMessageDesc(parent: DescMessage, msgIndexes: number[]): DescMessage {
    let index = msgIndexes[0]
    if (msgIndexes.length === 1) {
      return parent.nestedMessages[index]
    }
    return this.toNestedMessageDesc(parent.nestedMessages[index], msgIndexes.slice(1))
  }
}

async function transform(ctx: RuleContext, descriptor: DescMessage, msg: any, fieldTransform: FieldTransform): Promise<any> {
  if (msg == null || descriptor == null) {
    return msg
  }
  if (Array.isArray(msg)) {
    for (let i = 0; i < msg.length; i++) {
      msg[i] = await transform(ctx, descriptor, msg[i], fieldTransform)
    }
  }
  if (msg instanceof Map) {
    return msg
  }
  const typeName = msg.$typeName
  if (typeName != null) {
    const fields = descriptor.fields
    for (let i = 0; i < fields.length; i++) {
      const fd = fields[i]
      await transformField(ctx, fd, descriptor, msg, fieldTransform)
    }
    return msg
  }
  const fieldCtx = ctx.currentField()
  if (fieldCtx != null) {
    const ruleTags = ctx.rule.tags ?? []
    if (ruleTags == null || ruleTags.length === 0 || !disjoint(new Set<string>(ruleTags), fieldCtx.tags)) {
      return await fieldTransform.transform(ctx, fieldCtx, msg)
    }
  }
  return msg
}

async function transformField(ctx: RuleContext, fd: DescField, desc: DescMessage,
                        msg: any, fieldTransform: FieldTransform) {
  try {
    ctx.enterField(
      msg,
      desc.name + '.' + fd.name,
      fd.name,
      getType(fd),
      getInlineTags(fd)
    )
    const value = msg[fd.name]
    const newValue = await transform(ctx, desc, value, fieldTransform)
    if (ctx.rule.kind === 'CONDITION') {
      if (newValue === false) {
        throw new RuleConditionError(ctx.rule)
      }
    } else {
      msg[fd.name] = newValue
    }
  } finally {
    ctx.leaveField()
  }
}

function getType(fd: DescField): FieldType {
  switch (fd.fieldKind) {
    case 'map':
      return FieldType.MAP
    case 'list':
      return FieldType.ARRAY
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
        case ScalarType.DOUBLE:
          return FieldType.DOUBLE
        case ScalarType.BOOL:
          return FieldType.BOOLEAN
      }
    default:
      return FieldType.NULL
  }
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


