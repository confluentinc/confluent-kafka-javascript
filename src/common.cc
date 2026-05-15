/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
#include "src/common.h"

#include <iostream>
#include <list>
#include <string>
#include <vector>

namespace NodeKafka {

void Log(std::string str) {
  std::cerr << "% " << str.c_str() << std::endl;
}

template<typename T>
T GetParameter(Napi::Object object, std::string field_name, T def) {
  return def;
}

template<>
int64_t GetParameter<int64_t>(Napi::Object object,
  std::string field_name, int64_t def) {
  Napi::Env env = object.Env();
  Napi::String field = Napi::String::New(env, field_name.c_str());
  if (object.Has(field)) {
    Napi::Value v = object.Get(field);

    if (!v.IsNumber()) {
      return def;
    }

    return v.As<Napi::Number>().Int64Value();
  }
  return def;
}

template<>
bool GetParameter<bool>(Napi::Object object,
  std::string field_name, bool def) {
  Napi::Env env = object.Env();
  Napi::String field = Napi::String::New(env, field_name.c_str());
  if (object.Has(field)) {
    Napi::Value v = object.Get(field);

    if (!v.IsBoolean()) {
      return def;
    }

    return v.As<Napi::Boolean>().Value();
  }
  return def;
}

template<>
int GetParameter<int>(Napi::Object object,
  std::string field_name, int def) {
  return static_cast<int>(GetParameter<int64_t>(object, field_name, def));
}

template<>
std::string GetParameter<std::string>(Napi::Object object,
              std::string field_name,
              std::string def) {
  Napi::Env env = object.Env();
  Napi::String field = Napi::String::New(env, field_name.c_str());
  if (object.Has(field)) {
    Napi::Value parameter = object.Get(field);

    if (!parameter.IsUndefined() && !parameter.IsNull() &&
        parameter.IsString()) {
      return parameter.As<Napi::String>().Utf8Value();
    }
  }
  return def;
}

template<>
std::vector<std::string> GetParameter<std::vector<std::string> >(
  Napi::Object object, std::string field_name,
  std::vector<std::string> def) {
  Napi::Env env = object.Env();
  Napi::String field = Napi::String::New(env, field_name.c_str());

  if (object.Has(field)) {
    Napi::Value maybeArray = object.Get(field);
    if (maybeArray.IsArray()) {
      Napi::Array parameter = maybeArray.As<Napi::Array>();
      return v8ArrayToStringVector(parameter);
    }
  }
  return def;
}

std::vector<std::string> v8ArrayToStringVector(Napi::Array parameter) {
  std::vector<std::string> newItem;

  for (uint32_t i = 0; i < parameter.Length(); i++) {
    Napi::Value v = parameter.Get(i);
    if (v.IsString()) {
      newItem.push_back(v.As<Napi::String>().Utf8Value());
    }
  }
  return newItem;
}

std::list<std::string> v8ArrayToStringList(Napi::Array parameter) {
  std::list<std::string> newItem;

  for (uint32_t i = 0; i < parameter.Length(); i++) {
    Napi::Value v = parameter.Get(i);
    if (v.IsString()) {
      newItem.push_back(v.As<Napi::String>().Utf8Value());
    }
  }
  return newItem;
}

template<> Napi::Array GetParameter<Napi::Array >(
  Napi::Object object,
  std::string field_name,
  Napi::Array def) {
  Napi::Env env = object.Env();
  Napi::String field = Napi::String::New(env, field_name.c_str());

  if (object.Has(field)) {
    Napi::Value maybeArray = object.Get(field);
    if (maybeArray.IsArray()) {
      return maybeArray.As<Napi::Array>();
    }
  }

  return def;
}

namespace Conversion {

namespace Util {
std::vector<std::string> ToStringVector(Napi::Array parameter) {
  std::vector<std::string> newItem;
  Napi::Env env = parameter.Env();
  Napi::Function regexp_ctor =
      env.Global().Get("RegExp").As<Napi::Function>();

  for (uint32_t i = 0; i < parameter.Length(); i++) {
    Napi::Value element = parameter.Get(i);

    bool is_regexp = element.IsObject() &&
                     element.As<Napi::Object>().InstanceOf(regexp_ctor);

    if (!is_regexp) {
      if (element.IsString()) {
        newItem.push_back(element.As<Napi::String>().Utf8Value());
      }
    } else {
      Napi::Value source = element.As<Napi::Object>().Get("source");
      if (source.IsString()) {
        std::string pString = source.As<Napi::String>().Utf8Value();
        Log(pString);
        newItem.push_back(pString);
      }
    }
  }

  return newItem;
}

Napi::Array ToV8Array(Napi::Env env, std::vector<std::string> parameter) {
  Napi::Array newItem = Napi::Array::New(env);

  for (size_t i = 0; i < parameter.size(); i++) {
    std::string topic = parameter[i];
    (newItem).Set(i, Napi::String::New(env, topic));
  }

  return newItem;
}

/**
 * @brief Converts a list of rd_kafka_error_t* into a v8 array of RdKafkaError
 * objects.
 */
Napi::Array ToV8Array(Napi::Env env, const rd_kafka_error_t** error_list,
             size_t error_cnt) {
  Napi::Array errors = Napi::Array::New(env);

  for (size_t i = 0; i < error_cnt; i++) {
    RdKafka::ErrorCode code =
  static_cast<RdKafka::ErrorCode>(rd_kafka_error_code(error_list[i]));
    std::string msg = std::string(rd_kafka_error_string(error_list[i]));
    (errors).Set(i, RdKafkaError(env, code, msg).Value());
  }

  return errors;
}

/**
 * @brief Converts a rd_kafka_Node_t* into a v8 object.
 */
Napi::Object ToV8Object(Napi::Env env, const rd_kafka_Node_t* node) {
  /* Return object type
   {
      id: number
      host: string
      port: number
      rack?: string
    }
  */
  Napi::Object obj = Napi::Object::New(env);

  // Check if node is NULL - can happen during broker restarts/metadata updates
  if (!node) {
    (obj).Set(Napi::String::New(env, "id"), Napi::Number::New(env, -1));
    (obj).Set(Napi::String::New(env, "host"), Napi::String::New(env, ""));
    (obj).Set(Napi::String::New(env, "port"), Napi::Number::New(env, -1));
    return obj;
  }

  (obj).Set(Napi::String::New(env, "id"),
     Napi::Number::New(env, rd_kafka_Node_id(node)));

  // Check host for NULL before using - prevents segfault when host is NULL
  const char* host = rd_kafka_Node_host(node);
  if (host) {
    (obj).Set(Napi::String::New(env, "host"), Napi::String::New(env, host));
  } else {
    (obj).Set(Napi::String::New(env, "host"), Napi::String::New(env, ""));
  }

  (obj).Set(Napi::String::New(env, "port"),
     Napi::Number::New(env, rd_kafka_Node_port(node)));

  const char* rack = rd_kafka_Node_rack(node);
  if (rack) {
    (obj).Set(Napi::String::New(env, "rack"),
       Napi::String::New(env, rack));
  }

  return obj;
}

/**
 * @brief Converts a rd_kafka_Uuid_t* into a v8 object.
 */
Napi::Object UuidToV8Object(Napi::Env env, const rd_kafka_Uuid_t* uuid) {
  /*Return object type
    {
  mostSignificantBits: bigint
  leastSignificantBits: bigint
  base64: string
    }
  */
  Napi::Object obj = Napi::Object::New(env);

  (obj).Set(Napi::String::New(env, "mostSignificantBits"),
     Napi::BigInt::New(env, static_cast<int64_t>(
         rd_kafka_Uuid_most_significant_bits(uuid))));
  (obj).Set(Napi::String::New(env, "leastSignificantBits"),
     Napi::BigInt::New(env, static_cast<int64_t>(
         rd_kafka_Uuid_least_significant_bits(uuid))));
  (obj).Set(Napi::String::New(env, "base64"),
      Napi::String::New(env, rd_kafka_Uuid_base64str(uuid)));

  return obj;
}

/**
 * @brief Converts a list of rd_kafka_AclOperation_t into a v8 array.
 */
Napi::Array ToV8Array(
    Napi::Env env,
    const rd_kafka_AclOperation_t* authorized_operations,
    size_t authorized_operations_cnt) {
  Napi::Array array = Napi::Array::New(env);

  for (size_t i = 0; i < authorized_operations_cnt; i++) {
    (array).Set(i, Napi::Number::New(env, authorized_operations[i]));
  }

  return array;
}

}  // namespace Util

namespace TopicPartition {

/**
 * @brief RdKafka::TopicPartition vector to a v8 Array
 *
 * @see v8ArrayToTopicPartitionVector
 * @note This method returns a v8 array of a mix of topic partition
 *       objects and errors. For a more uniform return type of
 *       topic partitions (which have an internal error property),
 *       use `ToTopicPartitionV8Array(const rd_kafka_topic_partition_list_t*,
 *       bool)`.
 */
Napi::Array ToV8Array(
  Napi::Env env,
  std::vector<RdKafka::TopicPartition*> & topic_partition_list) {  // NOLINT
  Napi::Array array = Napi::Array::New(env);
  for (size_t topic_partition_i = 0;
    topic_partition_i < topic_partition_list.size(); topic_partition_i++) {
    RdKafka::TopicPartition* topic_partition =
      topic_partition_list[topic_partition_i];

    // TODO: why do we set the entire array element to be an error rather adding
    // an error field to TopicPartition? Or create a TopicPartitionError?
    if (topic_partition->err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
      (array).Set(topic_partition_i,
  RdKafkaError(env, topic_partition->err()).Value());
    } else {
      // We have the list now let's get the properties from it
      Napi::Object obj = Napi::Object::New(env);

      if (topic_partition->offset() != RdKafka::Topic::OFFSET_INVALID) {
  (obj).Set(Napi::String::New(env, "offset"),
    Napi::Number::New(env, topic_partition->offset()));
      }

      // If present, size >= 1, since it will include at least the
      // null terminator.
      if (topic_partition->get_metadata().size() > 0) {
  (obj).Set(Napi::String::New(env, "metadata"),
    Napi::String::New(env,
      reinterpret_cast<const char*>(topic_partition->get_metadata().data()), // NOLINT
      // null terminator is not required by the constructor.
      topic_partition->get_metadata().size() - 1));
      }

      (obj).Set(Napi::String::New(env, "partition"),
  Napi::Number::New(env, topic_partition->partition()));
      (obj).Set(Napi::String::New(env, "topic"),
  Napi::String::New(env, topic_partition->topic().c_str()));

      int leader_epoch = topic_partition->get_leader_epoch();
      if (leader_epoch >= 0) {
  (obj).Set(Napi::String::New(env, "leaderEpoch"),
     Napi::Number::New(env, leader_epoch));
      }

      (array).Set(topic_partition_i, obj);
    }
  }

  return array;
}

/**
 * @brief Converts a rd_kafka_topic_partition_list_t* into a list of v8 objects.
 *
 * @param topic_partition_list The list of topic partitions to convert.
 * @param include_offset Whether to include the offset in the output.
 * @returns [{topic: string, partition: number, offset?: number, error?:
 * LibrdKafkaError}]
 *
 * @note Contains error within the topic partitions object, and not as separate
 * array elements, unlike the `ToV8Array(std::vector<RdKafka::TopicPartition*> &
 * topic_partition_list)`.
 */
Napi::Array ToTopicPartitionV8Array(
    Napi::Env env,
    const rd_kafka_topic_partition_list_t* topic_partition_list,
    bool include_offset) {
  Napi::Array array = Napi::Array::New(env);

  for (int topic_partition_i = 0; topic_partition_i < topic_partition_list->cnt;
       topic_partition_i++) {
    rd_kafka_topic_partition_t topic_partition =
  topic_partition_list->elems[topic_partition_i];
    Napi::Object obj = Napi::Object::New(env);

    (obj).Set(Napi::String::New(env, "partition"),
       Napi::Number::New(env, topic_partition.partition));
    (obj).Set(Napi::String::New(env, "topic"),
       Napi::String::New(env, topic_partition.topic));

    if (topic_partition.err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      Napi::Object error = NodeKafka::RdKafkaError(
    env, static_cast<RdKafka::ErrorCode>(topic_partition.err)).Value();
      (obj).Set(Napi::String::New(env, "error"), error);
    }

    if (include_offset) {
      (obj).Set(Napi::String::New(env, "offset"),
         Napi::Number::New(env, topic_partition.offset));
    }

    int leader_epoch =
  rd_kafka_topic_partition_get_leader_epoch(&topic_partition);
    if (leader_epoch >= 0) {
      (obj).Set(Napi::String::New(env, "leaderEpoch"),
         Napi::Number::New(env, leader_epoch));
    }

    (array).Set(topic_partition_i, obj);
  }
  return array;
}

/**
 * @brief v8 Array of topic partitions to RdKafka::TopicPartition vector
 *
 * @see v8ArrayToTopicPartitionVector
 *
 * @note You must delete all the pointers inside here when you are done!!
 */
std::vector<RdKafka::TopicPartition*> FromV8Array(
  const Napi::Array & topic_partition_list) {
  // NOTE: ARRAY OF POINTERS! DELETE THEM WHEN YOU ARE FINISHED
  std::vector<RdKafka::TopicPartition*> array;

  for (uint32_t topic_partition_i = 0;
    topic_partition_i < topic_partition_list.Length(); topic_partition_i++) {
    Napi::Value topic_partition_value = topic_partition_list
        .Get(topic_partition_i);

    if (topic_partition_value.IsObject()) {
      array.push_back(FromV8Object(
  topic_partition_value.As<Napi::Object>()));
    }
  }

  return array;
}

/**
 * @brief v8 Array of Topic Partitions to rd_kafka_topic_partition_list_t
 *
 * @note Converts a v8 array of type [{topic: string, partition: number,
 *       offset?: number}] to a rd_kafka_topic_partition_list_t
 */
rd_kafka_topic_partition_list_t* TopicPartitionv8ArrayToTopicPartitionList(
    Napi::Array parameter, bool include_offset) {
  rd_kafka_topic_partition_list_t* newList =
      rd_kafka_topic_partition_list_new(parameter.Length());

  for (uint32_t i = 0; i < parameter.Length(); i++) {
    Napi::Value v = parameter.Get(i);

    if (!v.IsObject()) {
      return NULL;  // Return NULL to indicate an error
    }

    Napi::Object item = v.As<Napi::Object>();

    std::string topic = GetParameter<std::string>(item, "topic", "");
    int partition = GetParameter<int>(item, "partition", -1);

    rd_kafka_topic_partition_t* toppar =
  rd_kafka_topic_partition_list_add(newList, topic.c_str(), partition);

    if (include_offset) {
      int64_t offset = GetParameter<int64_t>(item, "offset", 0);
      toppar->offset = offset;
    }
  }
  return newList;
}

/**
 * @brief v8 Array of Topic Partitions with offsetspec to
 *        rd_kafka_topic_partition_list_t
 *
 * @note Converts a v8 array of type [{topic: string, partition: number,
 *      offset: {timestamp: number}}] to a rd_kafka_topic_partition_list_t
 */
rd_kafka_topic_partition_list_t*
TopicPartitionOffsetSpecv8ArrayToTopicPartitionList(
    Napi::Array parameter) {
  Napi::Env env = parameter.Env();
  rd_kafka_topic_partition_list_t* newList =
      rd_kafka_topic_partition_list_new(parameter.Length());

  for (uint32_t i = 0; i < parameter.Length(); i++) {
    Napi::Value v = parameter.Get(i);

    if (!v.IsObject()) {
      return NULL;  // Return NULL to indicate an error
    }

    Napi::Object item = v.As<Napi::Object>();

    std::string topic = GetParameter<std::string>(item, "topic", "");
    int partition = GetParameter<int>(item, "partition", -1);

    rd_kafka_topic_partition_t* toppar =
  rd_kafka_topic_partition_list_add(newList, topic.c_str(), partition);

    Napi::Value offsetValue =
  item.Get(Napi::String::New(env, "offset"));
    if (offsetValue.IsObject()) {
      Napi::Object offsetObject = offsetValue.As<Napi::Object>();
      int64_t offset = GetParameter<int64_t>(offsetObject, "timestamp", 0);
      toppar->offset = offset;
    } else {
      toppar->offset = 0;
    }
  }
  return newList;
}

/**
 * @brief Napi::Object to RdKafka::TopicPartition
 *
 */
RdKafka::TopicPartition * FromV8Object(Napi::Object topic_partition) {
  std::string topic = GetParameter<std::string>(topic_partition, "topic", "");
  int partition = GetParameter<int>(topic_partition, "partition", -1);
  int64_t offset = GetParameter<int64_t>(topic_partition, "offset", 0);

  if (partition == -1) {
return NULL;
  }

  if (topic.empty()) {
    return NULL;
  }

  RdKafka::TopicPartition *toppar =
    RdKafka::TopicPartition::create(topic, partition, offset);

  Napi::Env env = topic_partition.Env();
  Napi::String metadataKey = Napi::String::New(env, "metadata");
  if (topic_partition.Has(metadataKey)) {
    Napi::Value metadataValue = topic_partition.Get(metadataKey);

    if (metadataValue.IsString()) {
      std::string metadataValueStr = metadataValue.As<Napi::String>()
          .Utf8Value();
      std::vector<unsigned char> metadataVector(metadataValueStr.begin(),
            metadataValueStr.end());
      metadataVector.push_back(
    '\0');  // The null terminator is not included in the iterator.
      toppar->set_metadata(metadataVector);
    }
  }

  toppar->set_leader_epoch(-1);
  Napi::String leaderEpochKey =
      Napi::String::New(env, "leaderEpoch");
  if (topic_partition.Has(leaderEpochKey)) {
    Napi::Value leaderEpochValue = topic_partition.Get(leaderEpochKey);

    if (leaderEpochValue.IsNumber()) {
      int32_t leaderEpoch = leaderEpochValue.As<Napi::Number>().Int32Value();
      toppar->set_leader_epoch(leaderEpoch);
    }
  }

  return toppar;
}

}  // namespace TopicPartition

namespace Metadata {

/**
 * @brief RdKafka::Metadata to Napi::Object
 *
 */
Napi::Object ToV8Object(Napi::Env env, RdKafka::Metadata* metadata) {
  Napi::Object obj = Napi::Object::New(env);

  Napi::Array broker_data = Napi::Array::New(env);
  Napi::Array topic_data = Napi::Array::New(env);

  const BrokerMetadataList* brokers = metadata->brokers();  // NOLINT

  unsigned int broker_i = 0;

  for (BrokerMetadataList::const_iterator it = brokers->begin();
    it != brokers->end(); ++it, broker_i++) {
    // Start iterating over brokers and set the object up

    const RdKafka::BrokerMetadata* x = *it;

    Napi::Object current_broker = Napi::Object::New(env);

    (current_broker).Set(Napi::String::New(env, "id"),
      Napi::Number::New(env, x->id()));
    (current_broker).Set(Napi::String::New(env, "host"),
      Napi::String::New(env, x->host().c_str()));
    (current_broker).Set(Napi::String::New(env, "port"),
      Napi::Number::New(env, x->port()));

    (broker_data).Set(broker_i, current_broker);
  }

  unsigned int topic_i = 0;

  const TopicMetadataList* topics = metadata->topics();

  for (TopicMetadataList::const_iterator it = topics->begin();
    it != topics->end(); ++it, topic_i++) {
    // Start iterating over topics

    const RdKafka::TopicMetadata* x = *it;

    Napi::Object current_topic = Napi::Object::New(env);

    (current_topic).Set(Napi::String::New(env, "name"),
      Napi::String::New(env, x->topic().c_str()));

    Napi::Array current_topic_partitions = Napi::Array::New(env);

    const PartitionMetadataList* current_partition_data = x->partitions();

    unsigned int partition_i = 0;
    PartitionMetadataList::const_iterator itt;

    for (itt = current_partition_data->begin();
      itt != current_partition_data->end(); ++itt, partition_i++) {
      // partition iterate
      const RdKafka::PartitionMetadata* xx = *itt;

      Napi::Object current_partition = Napi::Object::New(env);

      (current_partition).Set(Napi::String::New(env, "id"),
  Napi::Number::New(env, xx->id()));
      (current_partition).Set(Napi::String::New(env, "leader"),
  Napi::Number::New(env, xx->leader()));

      const std::vector<int32_t> * replicas  = xx->replicas();
      const std::vector<int32_t> * isrs = xx->isrs();

      std::vector<int32_t>::const_iterator r_it;
      std::vector<int32_t>::const_iterator i_it;

      unsigned int r_i = 0;
      unsigned int i_i = 0;

      Napi::Array current_replicas = Napi::Array::New(env);

      for (r_it = replicas->begin(); r_it != replicas->end(); ++r_it, r_i++) {
  (current_replicas).Set(r_i, Napi::Number::New(env, *r_it));
      }

      Napi::Array current_isrs = Napi::Array::New(env);

      for (i_it = isrs->begin(); i_it != isrs->end(); ++i_it, i_i++) {
  (current_isrs).Set(i_i, Napi::Number::New(env, *i_it));
      }

      (current_partition).Set(Napi::String::New(env, "replicas"),
  current_replicas);
      (current_partition).Set(Napi::String::New(env, "isrs"),
  current_isrs);

      (current_topic_partitions).Set(partition_i, current_partition);
    }  // iterate over partitions

    (current_topic).Set(Napi::String::New(env, "partitions"),
      current_topic_partitions);

    (topic_data).Set(topic_i, current_topic);
  }  // End iterating over topics

  (obj).Set(Napi::String::New(env, "orig_broker_id"),
    Napi::Number::New(env, metadata->orig_broker_id()));

  (obj).Set(Napi::String::New(env, "orig_broker_name"),
    Napi::String::New(env, metadata->orig_broker_name()));

  (obj).Set(Napi::String::New(env, "topics"), topic_data);
  (obj).Set(Napi::String::New(env, "brokers"), broker_data);

  return obj;
}

}  // namespace Metadata

namespace Message {

// Overload for all use cases except delivery reports
Napi::Object ToV8Object(Napi::Env env, RdKafka::Message *message) {
  return ToV8Object(env, message, true, true);
}

Napi::Object ToV8Object(Napi::Env env, RdKafka::Message *message,
        bool include_payload,
        bool include_headers) {
  if (message->err() == RdKafka::ERR_NO_ERROR) {
    Napi::Object pack = Napi::Object::New(env);

    const void* message_payload = message->payload();

    if (!include_payload) {
      (pack).Set(Napi::String::New(env, "value"),
  env.Undefined());
    } else if (message_payload) {
      (pack).Set(Napi::String::New(env, "value"),
  Napi::Buffer<uint8_t>::Copy(env,
          static_cast<const uint8_t*>(message_payload),
          message->len()));
    } else {
      (pack).Set(Napi::String::New(env, "value"),
  env.Null());
    }

    RdKafka::Headers* headers;
    if (((headers = message->headers()) != 0) && include_headers) {
      Napi::Array v8headers = Napi::Array::New(env);
      int index = 0;
      std::vector<RdKafka::Headers::Header> all = headers->get_all();
      for (std::vector<RdKafka::Headers::Header>::iterator it = all.begin();
                 it != all.end(); it++) {
  Napi::Object v8header = Napi::Object::New(env);
  (v8header).Set(Napi::String::New(env, it->key()),
    Napi::Buffer<uint8_t>::Copy(env,
            reinterpret_cast<const uint8_t*>(it->value_string()),
            it->value_size()));
  (v8headers).Set(index, v8header);
  index++;
      }
      (pack).Set(Napi::String::New(env, "headers"), v8headers);
    }

    (pack).Set(Napi::String::New(env, "size"),
      Napi::Number::New(env, message->len()));

    const void* key_payload = message->key_pointer();

    if (key_payload) {
      // We want this to also be a buffer to avoid corruption
      // https://github.com/confluentinc/confluent-kafka-javascript/issues/208
      (pack).Set(Napi::String::New(env, "key"),
  Napi::Buffer<uint8_t>::Copy(env,
          static_cast<const uint8_t*>(key_payload),
          message->key_len()));
    } else {
      (pack).Set(Napi::String::New(env, "key"),
  env.Null());
    }

    (pack).Set(Napi::String::New(env, "topic"),
      Napi::String::New(env, message->topic_name()));
    (pack).Set(Napi::String::New(env, "offset"),
      Napi::Number::New(env, message->offset()));
    (pack).Set(Napi::String::New(env, "partition"),
      Napi::Number::New(env, message->partition()));
    (pack).Set(Napi::String::New(env, "timestamp"),
      Napi::Number::New(env, message->timestamp().timestamp));

    int32_t leader_epoch = message->leader_epoch();
    if (leader_epoch >= 0) {
      (pack).Set(Napi::String::New(env, "leaderEpoch"),
         Napi::Number::New(env, leader_epoch));
    }

    return pack;
  } else {
    return RdKafkaError(env, message->err()).Value();
  }
}

}  // namespace Message

/**
 * @section Admin API models
 */

namespace Admin {

/**
 * Create a low level rdkafka handle to represent a topic
 *
 *
 */
rd_kafka_NewTopic_t* FromV8TopicObject(
  Napi::Object object, std::string &errstr) {  // NOLINT
  Napi::Env env = object.Env();
  std::string topic_name = GetParameter<std::string>(object, "topic", "");
  int num_partitions = GetParameter<int>(object, "num_partitions", 0);
  int replication_factor = GetParameter<int>(object, "replication_factor", 0);

  char errbuf[512];

  rd_kafka_NewTopic_t* new_topic = rd_kafka_NewTopic_new(
    topic_name.c_str(),
    num_partitions,
    replication_factor,
    errbuf,
    sizeof(errbuf));

  if (new_topic == NULL) {
    errstr = std::string(errbuf);
    return NULL;
  }

  rd_kafka_resp_err_t err;

  if (object.Has(Napi::String::New(env, "config"))) {
    // Get the config Napi::Object that we can get parameters on
    Napi::Object config =
      object.Get(Napi::String::New(env, "config")).As<Napi::Object>();

    // Get all of the keys of the object
    Napi::Array field_array = config.GetPropertyNames();

    for (uint32_t i = 0; i < field_array.Length(); i++) {
      Napi::String config_key = field_array.Get(i).As<Napi::String>();
      Napi::Value config_value = config.Get(config_key);

      // If the config value is a string...
      if (config_value.IsString()) {
        std::string pKeyString = config_key.Utf8Value();
        std::string pValString = config_value.As<Napi::String>().Utf8Value();

        err = rd_kafka_NewTopic_set_config(
    new_topic, pKeyString.c_str(), pValString.c_str());

        if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
    errstr = rd_kafka_err2str(err);
    rd_kafka_NewTopic_destroy(new_topic);
    return NULL;
        }
      } else {
        errstr = "Config values must all be provided as strings.";
        rd_kafka_NewTopic_destroy(new_topic);
        return NULL;
      }
    }
  }

  return new_topic;
}

rd_kafka_NewTopic_t** FromV8TopicObjectArray(Napi::Array) {
  return NULL;
}

/**
 * @brief Converts a v8 array of group states into a vector of
 * rd_kafka_consumer_group_state_t.
 */
std::vector<rd_kafka_consumer_group_state_t> FromV8GroupStateArray(
    Napi::Array array) {
  std::vector<rd_kafka_consumer_group_state_t> returnVec;
  for (uint32_t i = 0; i < array.Length(); i++) {
    Napi::Value v = array.Get(i);
    if (!v.IsNumber()) {
      continue;
    }
    int64_t state_number = v.As<Napi::Number>().Int64Value();
    if (state_number >= RD_KAFKA_CONSUMER_GROUP_STATE__CNT) {
      continue;
    }
    returnVec.push_back(
  static_cast<rd_kafka_consumer_group_state_t>(state_number));
  }
  return returnVec;
}

/**
 * @brief Converts a v8 array of group types into a vector of
 * rd_kafka_consumer_group_type_t.
 */
std::vector<rd_kafka_consumer_group_type_t> FromV8GroupTypeArray(
    Napi::Array array) {
  std::vector<rd_kafka_consumer_group_type_t> returnVec;
  for (uint32_t i = 0; i < array.Length(); i++) {
    Napi::Value v = array.Get(i);
    if (!v.IsNumber()) {
      continue;
    }
    int64_t type_number = v.As<Napi::Number>().Int64Value();
    if (type_number < 0 || type_number >= RD_KAFKA_CONSUMER_GROUP_TYPE__CNT) {
      continue;
    }
    returnVec.push_back(
        static_cast<rd_kafka_consumer_group_type_t>(type_number));
  }
  return returnVec;
}

/**
 * @brief Converts a rd_kafka_ListConsumerGroups_result_t* into a v8 object.
 */
Napi::Object FromListConsumerGroupsResult(
    Napi::Env env, const rd_kafka_ListConsumerGroups_result_t* result) {
  /* Return object type:
    {
      groups: {
  groupId: string,
  protocolType: string,
  isSimpleConsumerGroup: boolean,
  state: ConsumerGroupState (internally a number)
  type: ConsumerGroupType (internally a number)
      }[],
      errors: LibrdKafkaError[]
    }
  */
  Napi::Object returnObject = Napi::Object::New(env);

  size_t error_cnt;
  const rd_kafka_error_t** error_list =
      rd_kafka_ListConsumerGroups_result_errors(result, &error_cnt);
  (returnObject).Set(Napi::String::New(env, "errors"),
     Conversion::Util::ToV8Array(env, error_list, error_cnt));

  Napi::Array groups = Napi::Array::New(env);
  size_t groups_cnt;
  const rd_kafka_ConsumerGroupListing_t** groups_list =
      rd_kafka_ListConsumerGroups_result_valid(result, &groups_cnt);

  for (size_t i = 0; i < groups_cnt; i++) {
    const rd_kafka_ConsumerGroupListing_t* group = groups_list[i];
    Napi::Object groupObject = Napi::Object::New(env);

    (groupObject).Set(Napi::String::New(env, "groupId"),
       Napi::String::New(env,
           rd_kafka_ConsumerGroupListing_group_id(group)));

    bool is_simple =
  rd_kafka_ConsumerGroupListing_is_simple_consumer_group(group);
    (groupObject).Set(Napi::String::New(env, "isSimpleConsumerGroup"),
       Napi::Boolean::New(env, is_simple));

    std::string protocol_type = is_simple ? "simple" : "consumer";
    (groupObject).Set(Napi::String::New(env, "protocolType"),
       Napi::String::New(env, protocol_type));

    (groupObject).Set(Napi::String::New(env, "state"),
       Napi::Number::New(env, rd_kafka_ConsumerGroupListing_state(group)));

    (groupObject).Set(Napi::String::New(env, "type"),
       Napi::Number::New(env, rd_kafka_ConsumerGroupListing_type(group)));

    (groups).Set(i, groupObject);
  }

  (returnObject).Set(Napi::String::New(env, "groups"), groups);
  return returnObject;
}

/**
 * @brief Converts a rd_kafka_MemberDescription_t* into a v8 object.
 */
Napi::Object FromMemberDescription(
    Napi::Env env, const rd_kafka_MemberDescription_t* member) {
  /* Return object type:
    {
  clientHost: string
  clientId: string
  memberId: string
  memberAssignment: Buffer // will be always null
  memberMetadata: Buffer // will be always null
  groupInstanceId: string
  assignment: {
    topicPartitions: TopicPartition[]
  },
  targetAssignment?: {
    topicPartitions: TopicPartition[]
  }
    }
  */
  Napi::Object returnObject = Napi::Object::New(env);

  // clientHost
  (returnObject).Set(Napi::String::New(env, "clientHost"),
     Napi::String::New(env, rd_kafka_MemberDescription_host(member)));

  // clientId
  (returnObject).Set(Napi::String::New(env, "clientId"),
     Napi::String::New(env,
         rd_kafka_MemberDescription_client_id(member)));

  // memberId
  (returnObject).Set(Napi::String::New(env, "memberId"),
     Napi::String::New(env,
         rd_kafka_MemberDescription_consumer_id(member)));

  // memberAssignment - not passed to user, always null
  (returnObject).Set(Napi::String::New(env, "memberAssignment"),
     env.Null());

  // memberMetadata - not passed to user, always null
  (returnObject).Set(Napi::String::New(env, "memberMetadata"),
     env.Null());

  // groupInstanceId
  const char* group_instance_id =
      rd_kafka_MemberDescription_group_instance_id(member);
  if (group_instance_id) {
    (returnObject).Set(Napi::String::New(env, "groupInstanceId"),
       Napi::String::New(env, group_instance_id));
  }

  // assignment
  const rd_kafka_MemberAssignment_t* assignment =
      rd_kafka_MemberDescription_assignment(member);
  const rd_kafka_topic_partition_list_t* partitions =
      rd_kafka_MemberAssignment_partitions(assignment);
  Napi::Array topicPartitions =
      Conversion::TopicPartition::ToTopicPartitionV8Array(env, partitions,
          false);
  Napi::Object assignmentObject = Napi::Object::New(env);
  (assignmentObject).Set(Napi::String::New(env, "topicPartitions"),
     topicPartitions);
  (returnObject).Set(Napi::String::New(env, "assignment"),
     assignmentObject);

  // targetAssignment
  const rd_kafka_MemberAssignment_t* target_assignment =
      rd_kafka_MemberDescription_target_assignment(member);
  if (target_assignment) {
    const rd_kafka_topic_partition_list_t* target_partitions =
        rd_kafka_MemberAssignment_partitions(target_assignment);
    Napi::Array targetTopicPartitions =
        Conversion::TopicPartition::ToTopicPartitionV8Array(
            env, target_partitions, false);
    Napi::Object targetAssignmentObject = Napi::Object::New(env);
    (targetAssignmentObject).Set(Napi::String::New(env, "topicPartitions"),
             targetTopicPartitions);
    (returnObject).Set(Napi::String::New(env, "targetAssignment"),
             targetAssignmentObject);
  }

  return returnObject;
}

/**
 * @brief Converts a rd_kafka_ConsumerGroupDescription_t* into a v8 object.
 */
Napi::Object FromConsumerGroupDescription(
    Napi::Env env, const rd_kafka_ConsumerGroupDescription_t* desc) {
  /* Return object type:
    {
      groupId: string,
      error: LibrdKafkaError,
      members: MemberDescription[],
      protocol: string
      isSimpleConsumerGroup: boolean
      protocolType: string
      partitionAssignor: string
      state: ConsumerGroupState - internally a number
      coordinator: Node
      authorizedOperations: AclOperationType[] - internally numbers
    }
  */
  Napi::Object returnObject = Napi::Object::New(env);

  // groupId
  (returnObject).Set(Napi::String::New(env, "groupId"),
      Napi::String::New(env,
          rd_kafka_ConsumerGroupDescription_group_id(desc)));

  // error
  const rd_kafka_error_t* error = rd_kafka_ConsumerGroupDescription_error(desc);
  if (error) {
    RdKafka::ErrorCode code =
  static_cast<RdKafka::ErrorCode>(rd_kafka_error_code(error));
    std::string msg = std::string(rd_kafka_error_string(error));
    (returnObject).Set(Napi::String::New(env, "error"),
       RdKafkaError(env, code, msg).Value());
  }

  // members
  Napi::Array members = Napi::Array::New(env);
  size_t member_cnt = rd_kafka_ConsumerGroupDescription_member_count(desc);
  for (size_t i = 0; i < member_cnt; i++) {
    const rd_kafka_MemberDescription_t* member =
  rd_kafka_ConsumerGroupDescription_member(desc, i);
    (members).Set(i, FromMemberDescription(env, member));
  }
  (returnObject).Set(Napi::String::New(env, "members"), members);

  // isSimpleConsumerGroup
  bool is_simple =
      rd_kafka_ConsumerGroupDescription_is_simple_consumer_group(desc);
  (returnObject).Set(Napi::String::New(env, "isSimpleConsumerGroup"),
     Napi::Boolean::New(env, is_simple));

  // protocolType
  std::string protocolType = is_simple ? "simple" : "consumer";
  (returnObject).Set(Napi::String::New(env, "protocolType"),
     Napi::String::New(env, protocolType));

  // protocol
  (returnObject).Set(Napi::String::New(env, "protocol"),
     Napi::String::New(env,
         rd_kafka_ConsumerGroupDescription_partition_assignor(desc)));

  // partitionAssignor
  (returnObject).Set(Napi::String::New(env, "partitionAssignor"),
     Napi::String::New(env,
         rd_kafka_ConsumerGroupDescription_partition_assignor(desc)));

  // state
  (returnObject).Set(Napi::String::New(env, "state"),
     Napi::Number::New(env, rd_kafka_ConsumerGroupDescription_state(desc)));

  // type
  (returnObject).Set(Napi::String::New(env, "type"),
     Napi::Number::New(env, rd_kafka_ConsumerGroupDescription_type(desc)));

  // coordinator
  const rd_kafka_Node_t* coordinator =
      rd_kafka_ConsumerGroupDescription_coordinator(desc);
  if (coordinator) {
    Napi::Object coordinatorObject =
  Conversion::Util::ToV8Object(env, coordinator);
    (returnObject).Set(Napi::String::New(env, "coordinator"),
       coordinatorObject);
  }

  // authorizedOperations
  size_t authorized_operations_cnt;
  const rd_kafka_AclOperation_t* authorized_operations =
      rd_kafka_ConsumerGroupDescription_authorized_operations(
    desc, &authorized_operations_cnt);
  if (authorized_operations) {
    (returnObject).Set(Napi::String::New(env, "authorizedOperations"),
       Conversion::Util::ToV8Array(env, authorized_operations,
           authorized_operations_cnt));
  }

  return returnObject;
}

/**
 * @brief Converts a rd_kafka_DescribeConsumerGroups_result_t* into a v8 object.
 */
Napi::Object FromDescribeConsumerGroupsResult(
    Napi::Env env, const rd_kafka_DescribeConsumerGroups_result_t* result) {
  /* Return object type:
    { groups: GroupDescription[] }
  */
  Napi::Object returnObject = Napi::Object::New(env);
  Napi::Array groups = Napi::Array::New(env);
  size_t groups_cnt;
  const rd_kafka_ConsumerGroupDescription_t** groups_list =
      rd_kafka_DescribeConsumerGroups_result_groups(result, &groups_cnt);

  for (size_t i = 0; i < groups_cnt; i++) {
    const rd_kafka_ConsumerGroupDescription_t* group = groups_list[i];
    (groups).Set(i, FromConsumerGroupDescription(env, group));
  }

  (returnObject).Set(Napi::String::New(env, "groups"), groups);
  return returnObject;
}

/**
 * @brief Converts a rd_kafka_DeleteGroups_result_t* into a v8 array.
*/
Napi::Array FromDeleteGroupsResult(
    Napi::Env env, const rd_kafka_DeleteGroups_result_t* result) {
  /* Return object type:
    [{
      groupId: string
      errorCode?: number
      error?: LibrdKafkaError
    }]
  */
  Napi::Array returnArray = Napi::Array::New(env);
  size_t result_cnt;
  const rd_kafka_group_result_t** results =
      rd_kafka_DeleteGroups_result_groups(result, &result_cnt);

  for (size_t i = 0; i < result_cnt; i++) {
    const rd_kafka_group_result_t* group_result = results[i];
    Napi::Object group_object = Napi::Object::New(env);

    (group_object).Set(Napi::String::New(env, "groupId"),
       Napi::String::New(env,
           rd_kafka_group_result_name(group_result)));

    const rd_kafka_error_t* error = rd_kafka_group_result_error(group_result);
    if (!error) {
      (group_object).Set(Napi::String::New(env, "errorCode"),
         Napi::Number::New(env, RD_KAFKA_RESP_ERR_NO_ERROR));
    } else {
      RdKafka::ErrorCode code =
    static_cast<RdKafka::ErrorCode>(rd_kafka_error_code(error));
      const char* msg = rd_kafka_error_string(error);

      (group_object).Set(Napi::String::New(env, "errorCode"),
         Napi::Number::New(env, code));
      (group_object).Set(Napi::String::New(env, "error"),
         RdKafkaError(env, code, msg).Value());
    }
    (returnArray).Set(i, group_object);
  }

  return returnArray;
}

/**
 * @brief Converts a rd_kafka_ListConsumerGroupOffsets_result_t*
 *        into a v8 Array.
 */
Napi::Array FromListConsumerGroupOffsetsResult(
    Napi::Env env, const rd_kafka_ListConsumerGroupOffsets_result_t* result) {
  /* Return Object type:
    GroupResults[] = [{
      groupId : string,
      error? : LibrdKafkaError,
      partitions : TopicPartitionOffset[]
    }]

    TopicPartitionOffset:
    {
      topic : string,
      partition : number,
      offset : number,
      metadata : string | null,
      leaderEpoch? : number,
      error? : LibrdKafkaError
    }
  */

  Napi::Array returnArray = Napi::Array::New(env);
  size_t result_cnt;
  const rd_kafka_group_result_t** res =
      rd_kafka_ListConsumerGroupOffsets_result_groups(result, &result_cnt);

  for (size_t i = 0; i < result_cnt; i++) {
    const rd_kafka_group_result_t* group_result = res[i];

    // Create group result object
    Napi::Object group_object = Napi::Object::New(env);

    // Set groupId
    std::string groupId = rd_kafka_group_result_name(group_result);
    (group_object).Set(Napi::String::New(env, "groupId"),
       Napi::String::New(env, groupId.c_str()));

    // Set group-level error (if any)
    const rd_kafka_error_t* group_error =
  rd_kafka_group_result_error(group_result);
    if (group_error) {
      RdKafka::ErrorCode code =
    static_cast<RdKafka::ErrorCode>(rd_kafka_error_code(group_error));
      const char* msg = rd_kafka_error_string(group_error);
      (group_object).Set(Napi::String::New(env, "error"),
         RdKafkaError(env, code, msg).Value());
    }

    // Get the list of partitions for this group
    const rd_kafka_topic_partition_list_t* partitionList =
  rd_kafka_group_result_partitions(group_result);

    // Prepare array for TopicPartitionOffset[]
    Napi::Array partitionsArray = Napi::Array::New(env);
    int partitionIndex = 0;

    for (int j = 0; j < partitionList->cnt; j++) {
      const rd_kafka_topic_partition_t* partition = &partitionList->elems[j];

      // Create the TopicPartitionOffset object
      Napi::Object partition_object = Napi::Object::New(env);

      // Set topic, partition, and offset
      (partition_object).Set(Napi::String::New(env, "topic"),
         Napi::String::New(env, partition->topic));
      (partition_object).Set(Napi::String::New(env, "partition"),
         Napi::Number::New(env, partition->partition));
      (partition_object).Set(Napi::String::New(env, "offset"),
         Napi::Number::New(env, partition->offset));

      // Set metadata (if available)
      if (partition->metadata != nullptr) {
  (partition_object).Set(Napi::String::New(env, "metadata"),
      Napi::String::New(env,
          static_cast<const char*>(partition->metadata)));
      } else {
  (partition_object).Set(Napi::String::New(env, "metadata"),
     env.Null());
      }

      // Set leaderEpoch (if available)
      int32_t leader_epoch =
    rd_kafka_topic_partition_get_leader_epoch(partition);
      if (leader_epoch >= 0) {
  (partition_object).Set(Napi::String::New(env, "leaderEpoch"),
     Napi::Number::New(env, leader_epoch));
      }

      // Set partition-level error (if any)
      if (partition->err != RD_KAFKA_RESP_ERR_NO_ERROR) {
  RdKafka::ErrorCode code =
      static_cast<RdKafka::ErrorCode>(partition->err);
  (partition_object).Set(Napi::String::New(env, "error"),
     RdKafkaError(env, code, rd_kafka_err2str(partition->err)).Value());
      }

      (partitionsArray).Set(partitionIndex++, partition_object);
    }

    (group_object).Set(Napi::String::New(env, "partitions"),
       partitionsArray);

    (returnArray).Set(i, group_object);
  }

  return returnArray;
}

/**
 * @brief Converts a rd_kafka_DeleteRecords_result_t* into a v8 Array.
 */
Napi::Array FromDeleteRecordsResult(
    Napi::Env env, const rd_kafka_DeleteRecords_result_t* result) {
  /* Return object type:
    [{
      topic: string,
      partition: number,
      lowWatermark: number,
      error?: LibrdKafkaError
    }]
  */
  const rd_kafka_topic_partition_list_t* partitionList =
      rd_kafka_DeleteRecords_result_offsets(result);

  Napi::Array partitionsArray = Napi::Array::New(env);
  int partitionIndex = 0;

  for (int j = 0; j < partitionList->cnt; j++) {
    const rd_kafka_topic_partition_t* partition = &partitionList->elems[j];

    // Create the TopicPartitionOffset object
    Napi::Object partition_object = Napi::Object::New(env);

    // Set topic, partition, and offset and error(if required)
    (partition_object).Set(Napi::String::New(env, "topic"),
       Napi::String::New(env, partition->topic));
    (partition_object).Set(Napi::String::New(env, "partition"),
       Napi::Number::New(env, partition->partition));
    (partition_object).Set(Napi::String::New(env, "lowWatermark"),
       Napi::Number::New(env, partition->offset));

    if (partition->err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      RdKafka::ErrorCode code = static_cast<RdKafka::ErrorCode>(partition->err);
      (partition_object).Set(Napi::String::New(env, "error"),
         RdKafkaError(env, code, rd_kafka_err2str(partition->err)).Value());
    }

    (partitionsArray).Set(partitionIndex++, partition_object);
  }

  return partitionsArray;
}

/**
 * @brief Converts a rd_kafka_DescribeTopics_result_t* into a v8 Array.
 */
Napi::Array FromDescribeTopicsResult(
    Napi::Env env, const rd_kafka_DescribeTopics_result_t* result) {
  /* Return object type:
   [{
     name: string,
     topicId: Uuid,
     isInternal: boolean,
     partitions: [{
       partition: number,
       leader: Node,
       isr: Node[],
       replicas: Node[],
     }]
     error?: LibrdKafkaError,
     authorizedOperations?: AclOperationType[]
    }]
  */

  /*
    Node:
    {
      id: number,
      host: string,
      port: number
      rack?: string
    }
  */

  Napi::Array returnArray = Napi::Array::New(env);
  size_t result_cnt;
  const rd_kafka_TopicDescription_t** results =
      rd_kafka_DescribeTopics_result_topics(result, &result_cnt);

  int topicIndex = 0;

  for (size_t i = 0; i < result_cnt; i++) {
    Napi::Object topic_object = Napi::Object::New(env);

    const char* topic_name = rd_kafka_TopicDescription_name(results[i]);
    (topic_object).Set(Napi::String::New(env, "name"),
       Napi::String::New(env, topic_name));

    const rd_kafka_Uuid_t* topic_id =
  rd_kafka_TopicDescription_topic_id(results[i]);
    (topic_object).Set(Napi::String::New(env, "topicId"),
       Conversion::Util::UuidToV8Object(env, topic_id));

    int is_internal = rd_kafka_TopicDescription_is_internal(results[i]);
    (topic_object).Set(Napi::String::New(env, "isInternal"),
       Napi::Boolean::New(env, is_internal));

    const rd_kafka_error_t* error = rd_kafka_TopicDescription_error(results[i]);
    if (error) {
      RdKafka::ErrorCode code =
    static_cast<RdKafka::ErrorCode>(rd_kafka_error_code(error));
      (topic_object).Set(Napi::String::New(env, "error"),
         RdKafkaError(env, code, rd_kafka_error_string(error)).Value());
    }

    size_t authorized_operations_cnt;
    const rd_kafka_AclOperation_t* authorized_operations =
  rd_kafka_TopicDescription_authorized_operations(
      results[i], &authorized_operations_cnt);
    if (authorized_operations) {
      (topic_object).Set(Napi::String::New(env, "authorizedOperations"),
         Conversion::Util::ToV8Array(env, authorized_operations,
             authorized_operations_cnt));
    }

    size_t partition_cnt;
    const rd_kafka_TopicPartitionInfo_t** partitions =
  rd_kafka_TopicDescription_partitions(results[i], &partition_cnt);
    Napi::Array partitionsArray = Napi::Array::New(env);
    for (size_t j = 0; j < partition_cnt; j++) {
      Napi::Object partition_object = Napi::Object::New(env);
      const rd_kafka_TopicPartitionInfo_t* partition = partitions[j];
      (partition_object).Set(Napi::String::New(env, "partition"),
         Napi::Number::New(env,
       rd_kafka_TopicPartitionInfo_partition(partition)));

      const rd_kafka_Node_t* leader =
    rd_kafka_TopicPartitionInfo_leader(partition);
      // Check leader for NULL - can happen when partition has no leader
      if (leader) {
        (partition_object).Set(Napi::String::New(env, "leader"),
           Conversion::Util::ToV8Object(env, leader));
      } else {
        (partition_object).Set(Napi::String::New(env, "leader"),
           env.Null());
      }

      size_t isr_cnt;
      const rd_kafka_Node_t** isr =
    rd_kafka_TopicPartitionInfo_isr(partition, &isr_cnt);
      Napi::Array isrArray = Napi::Array::New(env);
      for (size_t k = 0; k < isr_cnt; k++) {
  (isrArray).Set(k, Conversion::Util::ToV8Object(env, isr[k]));
      }
      (partition_object).Set(Napi::String::New(env, "isr"), isrArray);

      size_t replicas_cnt;
      const rd_kafka_Node_t** replicas =
    rd_kafka_TopicPartitionInfo_replicas(partition, &replicas_cnt);
      Napi::Array replicasArray = Napi::Array::New(env);
      for (size_t k = 0; k < replicas_cnt; k++) {
  (replicasArray).Set(k, Conversion::Util::ToV8Object(env, replicas[k]));
      }
      (partition_object).Set(Napi::String::New(env, "replicas"),
         replicasArray);

      (partitionsArray).Set(j, partition_object);
    }
    (topic_object).Set(Napi::String::New(env, "partitions"),
       partitionsArray);

    (returnArray).Set(topicIndex++, topic_object);
  }

  return returnArray;
}

/**
 * @brief Converts a rd_kafka_ListOffsets_result_t* into a v8 Array.
 */
Napi::Array FromListOffsetsResult(
    Napi::Env env, const rd_kafka_ListOffsets_result_t* result) {
  /* Return object type:
   [{
     topic: string,
     partition: number,
     offset: number,
     error: LibrdKafkaError
     timestamp: number
   }]
  */

  size_t result_cnt, i;
  const rd_kafka_ListOffsetsResultInfo_t** results =
      rd_kafka_ListOffsets_result_infos(result, &result_cnt);

  Napi::Array resultArray = Napi::Array::New(env);
  int partitionIndex = 0;

  for (i = 0; i < result_cnt; i++) {
    const rd_kafka_topic_partition_t* partition =
  rd_kafka_ListOffsetsResultInfo_topic_partition(results[i]);
    int64_t timestamp = rd_kafka_ListOffsetsResultInfo_timestamp(results[i]);

    // Create the ListOffsetsResult object
    Napi::Object partition_object = Napi::Object::New(env);

    // Set topic, partition, offset, error and timestamp
    (partition_object).Set(Napi::String::New(env, "topic"),
       Napi::String::New(env, partition->topic));
    (partition_object).Set(Napi::String::New(env, "partition"),
       Napi::Number::New(env, partition->partition));
    (partition_object).Set(Napi::String::New(env, "offset"),
       Napi::Number::New(env, partition->offset));
    if (partition->err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      RdKafka::ErrorCode code = static_cast<RdKafka::ErrorCode>(partition->err);
      (partition_object).Set(Napi::String::New(env, "error"),
         RdKafkaError(env, code, rd_kafka_err2str(partition->err)).Value());
    }
    // Set leaderEpoch (if available)
    int32_t leader_epoch =
  rd_kafka_topic_partition_get_leader_epoch(partition);
    if (leader_epoch >= 0) {
      (partition_object).Set(Napi::String::New(env, "leaderEpoch"),
    Napi::Number::New(env, leader_epoch));
    }
    (partition_object).Set(Napi::String::New(env, "timestamp"),
       Napi::Number::New(env, timestamp));

    (resultArray).Set(partitionIndex++, partition_object);
  }

  return resultArray;
}

}  // namespace Admin

}  // namespace Conversion

namespace Util {
  std::string FromV8String(Napi::String val) {
    return val.Utf8Value();
  }
}  // Namespace Util

}  // namespace NodeKafka
