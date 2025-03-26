/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_COMMON_H_
#define SRC_COMMON_H_

#include <napi.h>
#include <uv.h>

#include <list>
#include <iostream>
#include <string>
#include <vector>

#include "rdkafkacpp.h" // NOLINT
#include "rdkafka.h"  // NOLINT

typedef std::vector<const RdKafka::BrokerMetadata*> BrokerMetadataList;
typedef std::vector<const RdKafka::PartitionMetadata*> PartitionMetadataList;
typedef std::vector<const RdKafka::TopicMetadata *> TopicMetadataList;

namespace NodeKafka {

void Log(std::string);

template<typename T> T GetParameter(Napi::Object, std::string, T);
template<> std::string GetParameter<std::string>(
  Napi::Object, std::string, std::string);
template<> std::vector<std::string> GetParameter<std::vector<std::string> >(
  Napi::Object, std::string, std::vector<std::string>);
template<> Napi::Array GetParameter<Napi::Array >(
  Napi::Object, std::string, Napi::Array);
// template int GetParameter<int>(v8::Local<v8::Object, std::string, int);
std::vector<std::string> v8ArrayToStringVector(Napi::Array);
std::list<std::string> v8ArrayToStringList(Napi::Array);

class scoped_mutex_lock {
 public:
  explicit scoped_mutex_lock(uv_mutex_t& lock_) :  // NOLINT
    async_lock(lock_) {
      uv_mutex_lock(&async_lock);
  }

  ~scoped_mutex_lock() {
    uv_mutex_unlock(&async_lock);
  }

 private:
  uv_mutex_t &async_lock;
};

/*
int uv_rwlock_tryrdlock(uv_rwlock_t* rwlock)

int uv_rwlock_trywrlock(uv_rwlock_t* rwlock)
 */

class scoped_shared_write_lock {
 public:
  explicit scoped_shared_write_lock(uv_rwlock_t& lock_) :  // NOLINT
    async_lock(lock_) {
      uv_rwlock_wrlock(&async_lock);
    }

  ~scoped_shared_write_lock() {
    uv_rwlock_wrunlock(&async_lock);
  }

 private:
  uv_rwlock_t &async_lock;
};

class scoped_shared_read_lock {
 public:
  explicit scoped_shared_read_lock(uv_rwlock_t& lock_) :  // NOLINT
    async_lock(lock_) {
      uv_rwlock_rdlock(&async_lock);
    }

  ~scoped_shared_read_lock() {
    uv_rwlock_rdunlock(&async_lock);
  }

 private:
  uv_rwlock_t &async_lock;
};

namespace Conversion {

namespace Util {
std::vector<std::string> ToStringVector(Napi::Array);
Napi::Array ToV8Array(std::vector<std::string>);
Napi::Array ToV8Array(const rd_kafka_error_t **error_list,
                               size_t error_cnt);
Napi::Object UuidToV8Object(const rd_kafka_Uuid_t* uuid);
Napi::Array ToV8Array(const rd_kafka_AclOperation_t *, size_t);

Napi::Object ToV8Object(const rd_kafka_Node_t *);
}  // namespace Util

namespace Admin {
// Topics from topic object, or topic object array
rd_kafka_NewTopic_t *FromV8TopicObject(Napi::Object,
                                       std::string &errstr);
rd_kafka_NewTopic_t **FromV8TopicObjectArray(Napi::Array);

// ListGroups: request
std::vector<rd_kafka_consumer_group_state_t> FromV8GroupStateArray(
    Napi::Array);

// ListGroups: response
Napi::Object FromListConsumerGroupsResult(
    const rd_kafka_ListConsumerGroups_result_t *);

// DescribeGroups: response
Napi::Object FromMemberDescription(
    const rd_kafka_MemberDescription_t *member);
Napi::Object FromConsumerGroupDescription(
    const rd_kafka_ConsumerGroupDescription_t *desc);
Napi::Object FromDescribeConsumerGroupsResult(
    const rd_kafka_DescribeConsumerGroups_result_t *);

// DeleteGroups: Response
Napi::Array FromDeleteGroupsResult(
    const rd_kafka_DeleteGroups_result_t *);

// ListConsumerGroupOffsets: Response
Napi::Array FromListConsumerGroupOffsetsResult(
    const rd_kafka_ListConsumerGroupOffsets_result_t *result);

// DeleteRecords: Response
Napi::Array FromDeleteRecordsResult(
    const rd_kafka_DeleteRecords_result_t* result);

// DescribeTopics: Response
Napi::Array FromDescribeTopicsResult(
    const rd_kafka_DescribeTopics_result_t* result);

// ListOffsets: Response
Napi::Array FromListOffsetsResult(
    const rd_kafka_ListOffsets_result_t* result);
}  // namespace Admin

namespace TopicPartition {

Napi::Array ToV8Array(std::vector<RdKafka::TopicPartition *> &);
Napi::Array ToTopicPartitionV8Array(
    const rd_kafka_topic_partition_list_t *, bool include_offset);
RdKafka::TopicPartition *FromV8Object(Napi::Object);
std::vector<RdKafka::TopicPartition *> FromV8Array(const Napi::Array &);  // NOLINT
rd_kafka_topic_partition_list_t *TopicPartitionv8ArrayToTopicPartitionList(
    Napi::Array parameter, bool include_offset);
rd_kafka_topic_partition_list_t *
TopicPartitionOffsetSpecv8ArrayToTopicPartitionList(
    Napi::Array parameter);

}  // namespace TopicPartition

namespace Metadata {

Napi::Object ToV8Object(RdKafka::Metadata*);

}  // namespace Metadata

namespace Message {

Napi::Object ToV8Object(RdKafka::Message*);
Napi::Object ToV8Object(RdKafka::Message*, bool, bool);

}

}  // namespace Conversion

namespace Util {
  std::string FromV8String(Napi::String);
}

}  // namespace NodeKafka

#endif  // SRC_COMMON_H_
