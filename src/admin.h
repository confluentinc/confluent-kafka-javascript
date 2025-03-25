/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_ADMIN_H_
#define SRC_ADMIN_H_

#include <napi.h>
#include <uv.h>
#include <uv.h>
#include <iostream>
#include <string>
#include <vector>

#include "rdkafkacpp.h" // NOLINT
#include "rdkafka.h"  // NOLINT

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

class AdminClient : public Connection<AdminClient> {
 public:
  static void Init(Napi::Object);
  static Napi::Object NewInstance(Napi::Value);

  void ActivateDispatchers();
  void DeactivateDispatchers();

  Baton Connect();
  Baton Disconnect();

  Baton CreateTopic(rd_kafka_NewTopic_t* topic, int timeout_ms);
  Baton DeleteTopic(rd_kafka_DeleteTopic_t* topic, int timeout_ms);
  Baton CreatePartitions(rd_kafka_NewPartitions_t* topic, int timeout_ms);
  // Baton AlterConfig(rd_kafka_NewTopic_t* topic, int timeout_ms);
  // Baton DescribeConfig(rd_kafka_NewTopic_t* topic, int timeout_ms);
  Baton ListGroups(bool is_match_states_set,
                   std::vector<rd_kafka_consumer_group_state_t>& match_states,
                   int timeout_ms,
                   rd_kafka_event_t** event_response);
  Baton DescribeGroups(std::vector<std::string>& groups,
                       bool include_authorized_operations, int timeout_ms,
                       rd_kafka_event_t** event_response);
  Baton DeleteGroups(rd_kafka_DeleteGroup_t** group_list, size_t group_cnt,
                     int timeout_ms, rd_kafka_event_t** event_response);
  Baton ListConsumerGroupOffsets(rd_kafka_ListConsumerGroupOffsets_t** req,
                                 size_t req_cnt,
                                 bool require_stable_offsets, int timeout_ms,
                                 rd_kafka_event_t** event_response);
  Baton DeleteRecords(rd_kafka_DeleteRecords_t** del_records,
                      size_t del_records_cnt, int operation_timeout_ms,
                      int timeout_ms, rd_kafka_event_t** event_response);
  Baton DescribeTopics(rd_kafka_TopicCollection_t* topics,
                       bool include_authorized_operations, int timeout_ms,
                       rd_kafka_event_t** event_response);
  Baton ListOffsets(rd_kafka_topic_partition_list_t* partitions, int timeout_ms,
                    rd_kafka_IsolationLevel_t isolation_level,
                    rd_kafka_event_t** event_response);

 protected:
  static Napi::FunctionReference constructor;
  static void New(const Napi::CallbackInfo& info);

  explicit AdminClient(Conf* globalConfig);
  explicit AdminClient(Connection* existingConnection);
  ~AdminClient();

  bool is_derived = false;

 private:
  // Node methods
  // static Napi::Value NodeValidateTopic(const Napi::CallbackInfo& info);
  static Napi::Value NodeCreateTopic(const Napi::CallbackInfo& info);
  static Napi::Value NodeDeleteTopic(const Napi::CallbackInfo& info);
  static Napi::Value NodeCreatePartitions(const Napi::CallbackInfo& info);

  // Consumer group operations
  static Napi::Value NodeListGroups(const Napi::CallbackInfo& info);
  static Napi::Value NodeDescribeGroups(const Napi::CallbackInfo& info);
  static Napi::Value NodeDeleteGroups(const Napi::CallbackInfo& info);
  static Napi::Value NodeListConsumerGroupOffsets(const Napi::CallbackInfo& info);
  static Napi::Value NodeDeleteRecords(const Napi::CallbackInfo& info);
  static Napi::Value NodeDescribeTopics(const Napi::CallbackInfo& info);
  static Napi::Value NodeListOffsets(const Napi::CallbackInfo& info);

  static Napi::Value NodeConnect(const Napi::CallbackInfo& info);
  static Napi::Value NodeDisconnect(const Napi::CallbackInfo& info);
};

}  // namespace NodeKafka

#endif  // SRC_ADMIN_H_
