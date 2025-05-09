/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_PRODUCER_H_
#define SRC_PRODUCER_H_

#include <napi.h>
#include <uv.h>
#include <napi.h>
#include <uv.h>
#include <node_buffer.h>
#include <string>
#include <vector>

#include "rdkafkacpp.h" // NOLINT

#include "src/common.h"
#include "src/connection.h"
#include "src/callbacks.h"
#include "src/topic.h"

namespace NodeKafka {

class ProducerMessage {
 public:
  explicit ProducerMessage(Napi::Object, NodeKafka::Topic*);
  ~ProducerMessage();

  void* Payload();
  size_t Size();
  bool IsEmpty();
  RdKafka::Topic * GetTopic();

  std::string m_errstr;

  Topic * m_topic;
  int32_t m_partition;
  std::string m_key;

  void* m_buffer_data;
  size_t m_buffer_length;

  bool m_is_empty;
};

class Producer : public Connection<Producer> {
 public:
  static void Init(const Napi::Env&, Napi::Object);

  Baton Connect();
  void Disconnect();
  void Poll();
  Baton SetPollInBackground(bool);
  #if RD_KAFKA_VERSION > 0x00090200
  Baton Flush(int timeout_ms);
  #endif

  Baton Produce(void* message, size_t message_size,
    RdKafka::Topic* topic, int32_t partition,
    const void* key, size_t key_len,
    void* opaque);

  Baton Produce(void* message, size_t message_size,
    std::string topic, int32_t partition,
    std::string* key,
    int64_t timestamp, void* opaque,
    RdKafka::Headers* headers);

  Baton Produce(void* message, size_t message_size,
    std::string topic, int32_t partition,
    const void* key, size_t key_len,
    int64_t timestamp, void* opaque,
    RdKafka::Headers* headers);

  void ActivateDispatchers();
  void DeactivateDispatchers();

  // void ConfigureCallback(const std::string& string_key,
  //                        const Napi::Function& cb, bool add) override;

  Baton InitTransactions(int32_t timeout_ms);
  Baton BeginTransaction();
  Baton CommitTransaction(int32_t timeout_ms);
  Baton AbortTransaction(int32_t timeout_ms);
  Baton SendOffsetsToTransaction(
    std::vector<RdKafka::TopicPartition*> &offsets,
    NodeKafka::KafkaConsumer* consumer,
    int timeout_ms);

 protected:
  static Napi::FunctionReference constructor;
  static void New(const Napi::CallbackInfo&);

  Producer(const Napi::CallbackInfo& info);
  ~Producer();

 private:
  Napi::Value NodeProduce(const Napi::CallbackInfo& info);
  Napi::Value NodeSetPartitioner(const Napi::CallbackInfo& info);
  Napi::Value NodeConnect(const Napi::CallbackInfo& info);
  Napi::Value NodeDisconnect(const Napi::CallbackInfo& info);
  Napi::Value NodePoll(const Napi::CallbackInfo& info);
  Napi::Value NodeSetPollInBackground(const Napi::CallbackInfo& info);
  #if RD_KAFKA_VERSION > 0x00090200
  Napi::Value NodeFlush(const Napi::CallbackInfo& info);
  #endif
  Napi::Value NodeInitTransactions(const Napi::CallbackInfo& info);
  Napi::Value NodeBeginTransaction(const Napi::CallbackInfo& info);
  Napi::Value NodeCommitTransaction(const Napi::CallbackInfo& info);
  Napi::Value NodeAbortTransaction(const Napi::CallbackInfo& info);
  Napi::Value NodeSendOffsetsToTransaction(const Napi::CallbackInfo& info);

  Callbacks::Delivery m_dr_cb;
  Callbacks::Partitioner m_partitioner_cb;
  bool m_is_background_polling;
};

}  // namespace NodeKafka

#endif  // SRC_PRODUCER_H_
