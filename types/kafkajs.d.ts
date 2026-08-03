import {
  ConsumerGlobalConfig,
  ConsumerTopicConfig,
  GlobalConfig,
  ProducerGlobalConfig,
  ProducerTopicConfig } from './config'
import {
  ConsumerGroupStates,
  GroupOverview,
  LibrdKafkaError,
  GroupDescriptions,
  DeleteGroupsResult,
  DeleteRecordsResult,
  Node,
  AclOperationTypes,
  Uuid,
  IsolationLevel,
  ConsumerGroupTypes
} from './rdkafka'

import {
  CODES
} from './errors';

// Admin API related interfaces, types etc; and Error types are common, so
// just re-export them from here too.
export {
  ConsumerGroupStates,
  GroupOverview,
  LibrdKafkaError,
  GroupDescriptions,
  DeleteGroupsResult,
  DeleteRecordsResult,
  Node,
  AclOperationTypes,
  Uuid,
  IsolationLevel,
  ConsumerGroupTypes
} from './rdkafka'

export interface OauthbearerProviderResponse {
  value: string,
  principal: string,
  lifetime: number, // Lifetime must be in milliseconds.
  extensions?: Map<string, string> | { [key: string]: string },
}

type SASLMechanismOptionsMap = {
  plain: { username: string; password: string }
  'scram-sha-256': { username: string; password: string }
  'scram-sha-512': { username: string; password: string }
  oauthbearer: { oauthBearerProvider: () => Promise<OauthbearerProviderResponse> }
}

export type SASLMechanism = keyof SASLMechanismOptionsMap
type SASLMechanismOptions<T> = T extends SASLMechanism
  ? { mechanism: T } & SASLMechanismOptionsMap[T]
  : never
export type SASLOptions = SASLMechanismOptions<SASLMechanism>

export interface RetryOptions {
  maxRetryTime?: number
  initialRetryTime?: number
  retries?: number
}

export enum logLevel {
  NOTHING = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export type Logger = {
  info: (message: string, extra?: object) => void
  error: (message: string, extra?: object) => void
  warn: (message: string, extra?: object) => void
  debug: (message: string, extra?: object) => void

  namespace: (namespace: string, logLevel?: logLevel) => Logger
  setLogLevel: (logLevel: logLevel) => void
}

export interface KafkaConfig {
  brokers: string[],
  ssl?: boolean,
  sasl?: SASLOptions,
  clientId?: string
  connectionTimeout?: number
  authenticationTimeout?: number
  requestTimeout?: number
  enforceRequestTimeout?: boolean,
  retry?: RetryOptions,
  logLevel?: logLevel,
  logger?: Logger,
}

export interface CommonConstructorConfig extends GlobalConfig {
  kafkaJS?: KafkaConfig;
}

export class Kafka {
  constructor(config?: CommonConstructorConfig)
  producer<K = Buffer | string, V = Buffer | string>(config?: ProducerConstructorConfig<K, V>): Producer<K, V>
  consumer<K = Buffer, V = Buffer>(config: ConsumerConstructorConfig<K,V>): Consumer<K, V>
  admin(config?: AdminConstructorConfig): Admin
}

type Client = {
  connect(): Promise<void>
  disconnect(): Promise<void>
  logger(): Logger
  setSaslCredentialProvider(authInfo: { username: string, password: string }): void
  dependentAdmin(): Admin
}

export enum CompressionTypes {
  None = 'none',
  GZIP = 'gzip',
  Snappy = 'snappy',
  LZ4 = 'lz4',
  ZSTD = 'zstd',
}

export interface ProducerConfig {
  metadataMaxAge?: number
  allowAutoTopicCreation?: boolean
  idempotent?: boolean
  transactionalId?: string
  transactionTimeout?: number
  maxInFlightRequests?: number
  acks?: number
  compression?: CompressionTypes
  timeout?: number,
  retry?: RetryOptions,
  logLevel?: logLevel,
  logger?: Logger,
}

export interface Serializer<T> {
  serialize(topic: string, msg: T, headers?: IHeaders): Promise<Buffer>
  needsClusterId(): boolean
  setClusterId(clusterId: string): void
}

export interface KafkaSerializerBuilder<T> {
  build(config: ProducerConstructorConfig<unknown, unknown>, isKey: boolean): Serializer<T>
}

interface JSProducerConfig<K, V> {
  'js.key.serializer.builder'?: KafkaSerializerBuilder<K>
  'js.value.serializer.builder'?: KafkaSerializerBuilder<V>
}

type ProducerGlobalAndTopicConfig<K = Buffer | string, V = Buffer | string> = ProducerGlobalConfig & ProducerTopicConfig & JSProducerConfig<K, V>;

export interface ProducerConstructorConfig<K = Buffer | string, V = Buffer | string> extends ProducerGlobalAndTopicConfig<K, V> {
  kafkaJS?: ProducerConfig;
}

export interface IHeaders {
  [key: string]: Buffer | string | (Buffer | string)[] | undefined
}

export interface Message<K = Buffer | string, V = Buffer | string> {
  key?: K | null
  value: V | null
  partition?: number
  headers?: IHeaders
  timestamp?: string
}

export interface ProducerRecord<K = Buffer | string, V = Buffer | string> {
  topic: string
  messages: Message<K, V>[]
}

export interface TopicMessages<K = Buffer | string, V = Buffer | string> {
  topic: string
  messages: Message<K, V>[]
}

export interface ProducerBatch<K = Buffer | string, V = Buffer | string> {
  topicMessages?: TopicMessages<K, V>[]
}

export type RecordMetadata = {
  topicName: string
  partition: number
  errorCode: number
  offset?: string
  timestamp?: string
  baseOffset?: string
  logAppendTime?: string
  logStartOffset?: string
}

export type PartitionMetadata = {
  partitionErrorCode: number
  partitionId: number
  leader: number
  leaderNode?: Node | null
  replicas: number[]
  replicaNodes?: Node[]
  isr: number[]
  isrNodes?: Node[]
  offlineReplicas?: number[]
}

export type Transaction = Producer;

export type Producer<K = Buffer | string, V = Buffer | string> = Client & {
  send(record: ProducerRecord<K,V>): Promise<RecordMetadata[]>
  sendBatch(batch: ProducerBatch<K,V>): Promise<RecordMetadata[]>
  flush(args?: { timeout?: number }): Promise<void>
  clusterId(options?: { timeout?: number }): Promise<string>

  // Transactional producer-only methods.
  transaction(): Promise<Transaction>
  commit(): Promise<void>
  abort(): Promise<void>
  sendOffsets(args: { consumer: Consumer<unknown, unknown>, topics: TopicOffsets[] }): Promise<void>
  isActive(): boolean
}

export enum PartitionAssigners {
  roundRobin = 'roundrobin',
  range = 'range',
  cooperativeSticky = 'cooperative-sticky'
}

export enum PartitionAssignors {
  roundRobin = 'roundrobin',
  range = 'range',
  cooperativeSticky = 'cooperative-sticky'
}

export interface ConsumerConfig {
  groupId: string
  metadataMaxAge?: number
  sessionTimeout?: number
  rebalanceTimeout?: number
  heartbeatInterval?: number
  maxBytesPerPartition?: number
  minBytes?: number
  maxBytes?: number
  maxWaitTimeInMs?: number
  retry?: RetryOptions,
  logLevel?: logLevel,
  logger?: Logger,
  allowAutoTopicCreation?: boolean
  maxInFlightRequests?: number
  readUncommitted?: boolean
  rackId?: string
  fromBeginning?: boolean
  autoCommit?: boolean
  autoCommitInterval?: number,
  partitionAssigners?: PartitionAssigners[],
  partitionAssignors?: PartitionAssignors[],
}

export interface Deserializer<T> {
  deserialize(topic: string, payload: Buffer, headers?: IHeaders): Promise<T>
  needsClusterId(): boolean
  setClusterId(clusterId: string): void
}

export interface KafkaDeserializerBuilder<T> {
  build(config: ConsumerConstructorConfig<unknown, unknown>, isKey: boolean): Deserializer<T>
}

export interface JSConsumerConfig<K = Buffer, V = Buffer> {
  /**
   * Maximum batch size passed in eachBatch calls.
   * A value of -1 means no limit.
   *
   * @default 32
   */
  'js.consumer.max.batch.size'?: string | number,
  /**
   * Maximum cache size per worker in milliseconds based on the
   * consume rate estimated through the eachMessage/eachBatch calls.
   *
   * @default 1500
   */
  'js.consumer.max.cache.size.per.worker.ms'?: string | number

  'js.key.deserializer.builder'?: KafkaDeserializerBuilder<K>
  'js.value.deserializer.builder'?: KafkaDeserializerBuilder<V>
}

export type ConsumerGlobalAndTopicConfig<K = Buffer, V = Buffer> = ConsumerGlobalConfig & ConsumerTopicConfig & JSConsumerConfig<K,V>;

export interface ConsumerConstructorConfig<K = Buffer, V = Buffer> extends ConsumerGlobalAndTopicConfig<K,V> {
  kafkaJS?: ConsumerConfig;
}

interface MessageSetEntry<K = Buffer, V = Buffer> {
  key: Buffer | null
  value: Buffer | null
  deserializedKey?: K | null
  deserializedValue?: V | null
  timestamp: string
  attributes: number
  offset: string
  size: number
  headers?: never
  leaderEpoch?: number
}

interface RecordBatchEntry<K = Buffer, V = Buffer> {
  key: Buffer | null
  value: Buffer | null
  deserializedKey?: K | null
  deserializedValue?: V | null
  timestamp: string
  attributes: number
  offset: string
  headers: IHeaders
  size?: never
  leaderEpoch?: number
}

export type Batch<K = Buffer, V = Buffer> = {
  topic: string
  partition: number
  highWatermark: string
  messages: KafkaMessage<K,V>[]
  isEmpty(): boolean
  firstOffset(): string | null
  lastOffset(): string
  offsetLag(): string
  offsetLagLow(): string
}

export type KafkaMessage<K = Buffer, V = Buffer> = MessageSetEntry<K, V> | RecordBatchEntry<K, V>

export interface EachMessagePayload<K = Buffer, V = Buffer> {
  topic: string
  partition: number
  message: KafkaMessage<K, V>
  heartbeat(): Promise<void>
  pause(): () => void
}

export interface PartitionOffset {
  partition: number
  offset: string
}

export interface TopicOffsets {
  topic: string
  partitions: PartitionOffset[]
}

export interface EachBatchPayload<K = Buffer, V = Buffer> {
  batch: Batch<K,V>
  resolveOffset(offset: string): void
  heartbeat(): Promise<void>
  pause(): () => void
  commitOffsetsIfNecessary(): Promise<void>
  isRunning(): boolean
  isStale(): boolean
}

export type EachBatchHandler<K = Buffer, V = Buffer> = (payload: EachBatchPayload<K,V>) => Promise<void>

export type EachMessageHandler<K = Buffer, V = Buffer> = (payload: EachMessagePayload<K,V>) => Promise<void>

/**
 * @deprecated Replaced by ConsumerSubscribeTopics
 */
export type ConsumerSubscribeTopic = { topic: string | RegExp; replace?: boolean }

export type ConsumerSubscribeTopics = { topics: (string | RegExp)[]; replace?: boolean }

export type ConsumerRunConfig<K = Buffer, V = Buffer> = {
  eachBatchAutoResolve?: boolean,
  partitionsConsumedConcurrently?: number,
  eachMessage?: EachMessageHandler<K,V>
  eachBatch?: EachBatchHandler<K,V>
}

export type TopicPartitions = { topic: string; partitions: number[] }

export type TopicPartition = {
  topic: string
  partition: number
  leaderEpoch?: number
}
export type TopicPartitionOffset = TopicPartition & {
  offset: string
}

export type TopicPartitionOffsetAndMetadata = TopicPartitionOffset & {
  metadata?: string | null
}

export interface OffsetsByTopicPartition {
  topics: TopicOffsets[]
}

export type FetchOffsetsPartition = PartitionOffset & { metadata: string | null, leaderEpoch: number | null, error: LibrdKafkaError | null };

export type TopicInput = string[] | { topic: string; partitions: number[] }[]

export type SeekEntry = PartitionOffset

export type ITopicMetadata = {
  name: string
  topicId?: Uuid
  isInternal?: boolean
  partitions: PartitionMetadata[]
  authorizedOperations?: AclOperationTypes[]
}

export type Consumer<K = Buffer, V = Buffer> = Client & {
  subscribe(subscription: ConsumerSubscribeTopics | ConsumerSubscribeTopic): Promise<void>
  stop(): Promise<void>
  run(config?: ConsumerRunConfig<K,V>): Promise<void>
  storeOffsets(topicPartitions: Array<TopicPartitionOffsetAndMetadata>): void
  commitOffsets(topicPartitions?: Array<TopicPartitionOffsetAndMetadata>): Promise<void>
  committed(topicPartitions?: Array<TopicPartition>, timeout?: number): Promise<TopicPartitionOffsetAndMetadata[]>
  seek(topicPartitionOffset: TopicPartitionOffset): void
  pause(topics: Array<{ topic: string; partitions?: number[] }>): void
  paused(): TopicPartitions[]
  resume(topics: Array<{ topic: string; partitions?: number[] }>): void
  assignment(): TopicPartition[]
  clusterId(options?: { timeout?: number }): Promise<string>
}

export interface AdminConfig {
  retry?: RetryOptions
  logLevel?: logLevel,
  logger?: Logger,
}

export interface AdminConstructorConfig extends GlobalConfig {
  kafkaJS?: AdminConfig;
}

export interface ReplicaAssignment {
  partition: number
  replicas: Array<number>
}

export interface IResourceConfigEntry {
  name: string
  value: string
}

export interface ITopicConfig {
  topic: string
  numPartitions?: number
  replicationFactor?: number
  configEntries?: IResourceConfigEntry[]
}

export type Admin = {
  connect(): Promise<void>
  disconnect(): Promise<void>
  createTopics(options: {
    timeout?: number
    topics: ITopicConfig[]
  }): Promise<boolean>
  deleteTopics(options: { topics: string[]; timeout?: number }): Promise<void>
  listTopics(options?: { timeout?: number }): Promise<string[]>
  clusterId(options?: { timeout?: number }): Promise<string>
  listGroups(options?: {
    timeout?: number,
    matchConsumerGroupStates?: ConsumerGroupStates[],
    matchConsumerGroupTypes?: ConsumerGroupTypes[]
  }): Promise<{ groups: GroupOverview[], errors: LibrdKafkaError[] }>
  describeGroups(
    groups: string[],
    options?: { timeout?: number, includeAuthorizedOperations?: boolean }): Promise<GroupDescriptions>
  deleteGroups(groupIds: string[], options?: { timeout?: number }): Promise<DeleteGroupsResult[]>
  fetchOffsets(options: {
    groupId: string,
    topics?: TopicInput,
    timeout?: number,
    requireStableOffsets?: boolean }):
    Promise<Array<{topic: string; partitions:FetchOffsetsPartition[]}>>
  deleteTopicRecords(options: {
    topic: string; partitions: SeekEntry[];
    timeout?: number; operationTimeout?: number
  }): Promise<DeleteRecordsResult[]>
  fetchTopicMetadata(options?: {
    topics?: string[],
    includeAuthorizedOperations?: boolean,
    timeout?: number
  }): Promise<Array<ITopicMetadata>>
  fetchTopicOffsets(topic: string,
    options?: {
      timeout?: number,
      isolationLevel: IsolationLevel
    }): Promise<Array<SeekEntry & { high: string; low: string }>>
  fetchTopicOffsetsByTimestamp(topic: string,
    timestamp?: number,
    options?: {
      timeout?: number,
      isolationLevel: IsolationLevel
    }): Promise<Array<SeekEntry>>
}


export function isKafkaJSError(error: Error): boolean;

export const ErrorCodes: typeof CODES.ERRORS;

export class KafkaJSError extends Error {
  readonly message: Error['message']
  readonly name: string
  readonly retriable: boolean
  readonly fatal: boolean
  readonly abortable: boolean
  readonly code: number
  constructor(e: Error | string, metadata?: KafkaJSErrorMetadata)
}

export class KafkaJSProtocolError extends KafkaJSError {
  constructor(e: Error | string)
}

export class KafkaJSCreateTopicError extends KafkaJSError {
  readonly topic: string
  constructor(e: Error | string, topicName: string, metadata?: KafkaJSErrorMetadata)
}

export class KafkaJSDeleteGroupsError extends KafkaJSError {
  readonly groups: DeleteGroupsResult[]
  constructor(e: Error | string, groups?: KafkaJSDeleteGroupsErrorGroups[])
}

export class KafkaJSDeleteTopicRecordsError extends KafkaJSError {
  readonly partitions: KafkaJSDeleteTopicRecordsErrorPartition[]
  constructor(metadata: KafkaJSDeleteTopicRecordsErrorTopic)
}

export interface KafkaJSDeleteGroupsErrorGroups {
  groupId: string
  errorCode: number
  error: KafkaJSError
}

export interface KafkaJSDeleteTopicRecordsErrorTopic {
  topic: string
  partitions: KafkaJSDeleteTopicRecordsErrorPartition[]
}

export interface KafkaJSDeleteTopicRecordsErrorPartition {
  partition: number
  offset: string
  error: KafkaJSError
}

export class KafkaJSAggregateError extends Error {
  readonly errors: (Error | string)[]
  constructor(message: Error | string, errors: (Error | string)[])
}

export class KafkaJSOffsetOutOfRange extends KafkaJSProtocolError {
  readonly topic: string
  readonly partition: number
  constructor(e: Error | string, metadata?: KafkaJSErrorMetadata)
}

export class KafkaJSConnectionError extends KafkaJSError {
  constructor(e: Error | string, metadata?: KafkaJSErrorMetadata)
}

export class KafkaJSRequestTimeoutError extends KafkaJSError {
  constructor(e: Error | string, metadata?: KafkaJSErrorMetadata)
}

export class KafkaJSPartialMessageError extends KafkaJSError {
  constructor()
}

export class KafkaJSSASLAuthenticationError extends KafkaJSError {
  constructor()
}

export class KafkaJSGroupCoordinatorNotFound extends KafkaJSError {
  constructor()
}

export class KafkaJSNotImplemented extends KafkaJSError {
  constructor()
}

export class KafkaJSTimeout extends KafkaJSError {
  constructor()
}

export interface KafkaJSErrorMetadata {
  retriable?: boolean
  fatal?: boolean
  abortable?: boolean
  stack?: string
  code?: number
}
