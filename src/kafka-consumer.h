/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_KAFKA_CONSUMER_H_
#define SRC_KAFKA_CONSUMER_H_

#include <napi.h>
#include <uv.h>
#include <uv.h>
#include <iostream>
#include <string>
#include <vector>

#include "rdkafkacpp.h" // NOLINT

#include "src/common.h"
#include "src/connection.h"
#include "src/callbacks.h"

namespace NodeKafka {

/**
 * @brief KafkaConsumer v8 wrapped object.
 *
 * Specializes the connection to wrap a consumer object through compositional
 * inheritence. Establishes its prototype in node through `Init`
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

class KafkaConsumer : public Connection {
  friend class Producer;
 public:
  static void Init(Napi::Object);
  static Napi::Object NewInstance(Napi::Value);

  Baton Connect();
  Baton Disconnect();

  Baton Subscription();
  Baton Unsubscribe();
  bool IsSubscribed();

  Baton Pause(std::vector<RdKafka::TopicPartition*> &);
  Baton Resume(std::vector<RdKafka::TopicPartition*> &);

  // Asynchronous commit events
  Baton Commit(std::vector<RdKafka::TopicPartition*>);
  Baton Commit(RdKafka::TopicPartition*);
  Baton Commit();

  Baton OffsetsStore(std::vector<RdKafka::TopicPartition*> &);
  Baton GetWatermarkOffsets(std::string, int32_t, int64_t*, int64_t*);

  // Synchronous commit events
  Baton CommitSync(std::vector<RdKafka::TopicPartition*>);
  Baton CommitSync(RdKafka::TopicPartition*);
  Baton CommitSync();

  Baton Committed(std::vector<RdKafka::TopicPartition*> &, int timeout_ms);
  Baton Position(std::vector<RdKafka::TopicPartition*> &);

  Baton RefreshAssignments();
  Baton AssignmentLost();

  bool HasAssignedPartitions();
  int AssignedPartitionCount();

  Baton Assign(std::vector<RdKafka::TopicPartition*>);
  Baton Unassign();

  Baton IncrementalAssign(std::vector<RdKafka::TopicPartition*>);
  Baton IncrementalUnassign(std::vector<RdKafka::TopicPartition*>);

  std::string RebalanceProtocol();

  Baton Seek(const RdKafka::TopicPartition &partition, int timeout_ms);

  Baton Subscribe(std::vector<std::string>);
  Baton Consume(int timeout_ms);

  void ActivateDispatchers();
  void DeactivateDispatchers();

  void ConfigureCallback(const std::string& string_key,
                         const Napi::Function& cb, bool add) override;

 protected:
  static Napi::FunctionReference constructor;
  static void New(const Napi::CallbackInfo& info);

  KafkaConsumer(Conf *, Conf *);
  ~KafkaConsumer();

 private:
  static void part_list_print(const std::vector<RdKafka::TopicPartition*>&);

  std::vector<RdKafka::TopicPartition*> m_partitions;
  int m_partition_cnt;
  bool m_is_subscribed = false;

  void* m_consume_loop = nullptr;
  Callbacks::QueueNotEmpty m_queue_not_empty_cb;

  /* This is the same client as stored in m_client.
   * Prevents a dynamic_cast in every single method. */
  RdKafka::KafkaConsumer *m_consumer = nullptr;

  // Node methods
  static Napi::Value NodeConnect(const Napi::CallbackInfo& info);
  static Napi::Value NodeSubscribe(const Napi::CallbackInfo& info);
  static Napi::Value NodeDisconnect(const Napi::CallbackInfo& info);
  static Napi::Value NodeAssign(const Napi::CallbackInfo& info);
  static Napi::Value NodeUnassign(const Napi::CallbackInfo& info);
  static Napi::Value NodeIncrementalAssign(const Napi::CallbackInfo& info);
  static Napi::Value NodeIncrementalUnassign(const Napi::CallbackInfo& info);
  static Napi::Value NodeAssignments(const Napi::CallbackInfo& info);
  static Napi::Value NodeAssignmentLost(const Napi::CallbackInfo& info);
  static Napi::Value NodeRebalanceProtocol(const Napi::CallbackInfo& info);
  static Napi::Value NodeUnsubscribe(const Napi::CallbackInfo& info);
  static Napi::Value NodeCommit(const Napi::CallbackInfo& info);
  static Napi::Value NodeCommitSync(const Napi::CallbackInfo& info);
  static Napi::Value NodeCommitCb(const Napi::CallbackInfo& info);
  static Napi::Value NodeOffsetsStore(const Napi::CallbackInfo& info);
  static Napi::Value NodeOffsetsStoreSingle(const Napi::CallbackInfo& info);
  static Napi::Value NodeCommitted(const Napi::CallbackInfo& info);
  static Napi::Value NodePosition(const Napi::CallbackInfo& info);
  static Napi::Value NodeSubscription(const Napi::CallbackInfo& info);
  static Napi::Value NodeSeek(const Napi::CallbackInfo& info);
  static Napi::Value NodeGetWatermarkOffsets(const Napi::CallbackInfo& info);
  static Napi::Value NodeConsumeLoop(const Napi::CallbackInfo& info);
  static Napi::Value NodeConsume(const Napi::CallbackInfo& info);

  static Napi::Value NodePause(const Napi::CallbackInfo& info);
  static Napi::Value NodeResume(const Napi::CallbackInfo& info);
};

}  // namespace NodeKafka

#endif  // SRC_KAFKA_CONSUMER_H_
