import { ConsumerGlobalConfig, GlobalConfig, ProducerGlobalConfig } from './config'
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
  IsolationLevel
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
  constructor(config: CommonConstructorConfig)
  producer(config?: ProducerConstructorConfig): Producer
  consumer(config: ConsumerConstructorConfig): Consumer
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

export interface ProducerConstructorConfig extends ProducerGlobalConfig {
  kafkaJS?: ProducerConfig;
}

export interface IHeaders {
  [key: string]: Buffer | string | (Buffer | string)[] | undefined
}

export interface Message {
  key?: Buffer | string | null
  value: Buffer | string | null
  partition?: number
  headers?: IHeaders
  timestamp?: string
}

export interface ProducerRecord {
  topic: string
  messages: Message[]
}

export interface TopicMessages {
  topic: string
  messages: Message[]
}

export interface ProducerBatch {
  topicMessages?: TopicMessages[]
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
  leaderNode?: Node
  replicas: number[]
  replicaNodes?: Node[]
  isr: number[]
  isrNodes?: Node[]
  offlineReplicas?: number[]
}

export type Transaction = Producer;

export type Producer = Client & {
  send(record: ProducerRecord): Promise<RecordMetadata[]>
  sendBatch(batch: ProducerBatch): Promise<RecordMetadata[]>
  flush(args?: { timeout?: number }): Promise<void>

  // Transactional producer-only methods.
  transaction(): Promise<Transaction>
  commit(): Promise<void>
  abort(): Promise<void>
  sendOffsets(args: { consumer: Consumer, topics: TopicOffsets[] }): Promise<void>
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

export interface ConsumerConstructorConfig extends ConsumerGlobalConfig {
  kafkaJS?: ConsumerConfig;
}

interface MessageSetEntry {
  key: Buffer | null
  value: Buffer | null
  timestamp: string
  attributes: number
  offset: string
  size: number
  headers?: never
  leaderEpoch?: number
}

interface RecordBatchEntry {
  key: Buffer | null
  value: Buffer | null
  timestamp: string
  attributes: number
  offset: string
  headers: IHeaders
  size?: never
  leaderEpoch?: number
}

export type Batch = {
  topic: string
  partition: number
  highWatermark: string
  messages: KafkaMessage[]
  isEmpty(): boolean
  firstOffset(): string | null
  lastOffset(): string
}

export type KafkaMessage = MessageSetEntry | RecordBatchEntry

export interface EachMessagePayload {
  topic: string
  partition: number
  message: KafkaMessage
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

export interface EachBatchPayload {
  batch: Batch
  resolveOffset(offset: string): void
  heartbeat(): Promise<void>
  pause(): () => void
  commitOffsetsIfNecessary(): Promise<void>
  isRunning(): boolean
  isStale(): boolean
}

export type EachBatchHandler = (payload: EachBatchPayload) => Promise<void>

export type EachMessageHandler = (payload: EachMessagePayload) => Promise<void>

/**
 * @deprecated Replaced by ConsumerSubscribeTopics
 */
export type ConsumerSubscribeTopic = { topic: string | RegExp; replace?: boolean }

export type ConsumerSubscribeTopics = { topics: (string | RegExp)[]; replace?: boolean }

export type ConsumerRunConfig = {
  eachBatchAutoResolve?: boolean,
  partitionsConsumedConcurrently?: number,
  eachMessage?: EachMessageHandler
  eachBatch?: EachBatchHandler
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

export type FetchOffsetsPartition = PartitionOffset & { metadata: string | null, leaderEpoch: number | null, error?: LibrdKafkaError };

export type TopicInput = string[] | { topic: string; partitions: number[] }[]

export type SeekEntry = PartitionOffset

export type ITopicMetadata = {
  name: string
  topicId?: Uuid
  isInternal?: boolean
  partitions: PartitionMetadata[]
  authorizedOperations?: AclOperationTypes[]
}

export type Consumer = Client & {
  subscribe(subscription: ConsumerSubscribeTopics | ConsumerSubscribeTopic): Promise<void>
  stop(): Promise<void>
  run(config?: ConsumerRunConfig): Promise<void>
  storeOffsets(topicPartitions: Array<TopicPartitionOffsetAndMetadata>): void
  commitOffsets(topicPartitions?: Array<TopicPartitionOffsetAndMetadata>): Promise<void>
  committed(topicPartitions?: Array<TopicPartition>, timeout?: number): Promise<TopicPartitionOffsetAndMetadata[]>
  seek(topicPartitionOffset: TopicPartitionOffset): void
  pause(topics: Array<{ topic: string; partitions?: number[] }>): void
  paused(): TopicPartitions[]
  resume(topics: Array<{ topic: string; partitions?: number[] }>): void
  assignment(): TopicPartition[]
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
  listGroups(options?: {
    timeout?: number,
    matchConsumerGroupStates?: ConsumerGroupStates[]
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
  }): Promise<{ topics: Array<ITopicMetadata> }>
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
