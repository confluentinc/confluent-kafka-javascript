/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_WORKERS_H_
#define SRC_WORKERS_H_

#include <uv.h>
#include <nan.h>
#include <string>
#include <optional>
#include <vector>

#include "src/common.h"
#include "src/producer.h"
#include "src/kafka-consumer.h"
#include "src/admin.h"
#include "rdkafka.h"  // NOLINT

namespace NodeKafka {
namespace Workers {

class ErrorAwareWorker : public Nan::AsyncWorker {
 public:
  explicit ErrorAwareWorker(Nan::Callback* callback_) :
    Nan::AsyncWorker(callback_),
    m_baton(RdKafka::ERR_NO_ERROR) {}
  virtual ~ErrorAwareWorker() {}

  virtual void Execute() = 0;
  virtual void HandleOKCallback() = 0;
  void HandleErrorCallback() {
    Nan::HandleScope scope;

    // Construct error and add code to it.
    v8::Local<v8::Value> error = Nan::Error(ErrorMessage());
    Nan::Set(error.As<v8::Object>(), Nan::New("code").ToLocalChecked(),
      Nan::New(GetErrorCode()));

    const unsigned int argc = 1;
    v8::Local<v8::Value> argv[argc] = { error };

    callback->Call(argc, argv);
  }

 protected:
  void SetErrorCode(const int & code) {
    RdKafka::ErrorCode rd_err = static_cast<RdKafka::ErrorCode>(code);
    SetErrorCode(rd_err);
  }
  void SetErrorCode(const RdKafka::ErrorCode & err) {
    SetErrorBaton(Baton(err));
  }
  void SetErrorBaton(const NodeKafka::Baton & baton) {
    m_baton = baton;
    SetErrorMessage(m_baton.errstr().c_str());
  }

  int GetErrorCode() {
    return m_baton.err();
  }

  v8::Local<v8::Object> GetErrorObject() {
    return m_baton.ToObject();
  }

  Baton m_baton;
};

class MessageWorker : public ErrorAwareWorker {
 public:
  explicit MessageWorker(Nan::Callback* callback_)
      : ErrorAwareWorker(callback_), m_asyncdata() {
    m_async = new uv_async_t;
    uv_async_init(
      uv_default_loop(),
      m_async,
      m_async_message);
    m_async->data = this;

    uv_mutex_init(&m_async_lock);
  }

  virtual ~MessageWorker() {
    uv_mutex_destroy(&m_async_lock);
  }

  void WorkMessage() {
    if (!callback) {
      return;
    }

    std::vector<RdKafka::Message*> message_queue;
    std::vector<RdKafka::ErrorCode> warning_queue;

    {
      scoped_mutex_lock lock(m_async_lock);
      // Copy the vector and empty it
      m_asyncdata.swap(message_queue);
      m_asyncwarning.swap(warning_queue);
    }

    for (unsigned int i = 0; i < message_queue.size(); i++) {
      HandleMessageCallback(message_queue[i], RdKafka::ERR_NO_ERROR);

      // we are done with it. it is about to go out of scope
      // for the last time so let's just free it up here. can't rely
      // on the destructor
    }

    for (unsigned int i = 0; i < warning_queue.size(); i++) {
      HandleMessageCallback(NULL, warning_queue[i]);
    }
  }

  class ExecutionMessageBus {
    friend class MessageWorker;
   public:
     void Send(RdKafka::Message* m) const {
       that_->Produce_(m);
     }
     void SendWarning(RdKafka::ErrorCode c) const {
       that_->ProduceWarning_(c);
     }
    explicit ExecutionMessageBus(MessageWorker* that) : that_(that) {}
   private:
    MessageWorker* const that_;
  };

  virtual void Execute(const ExecutionMessageBus&) = 0;
  virtual void HandleMessageCallback(RdKafka::Message*, RdKafka::ErrorCode) = 0;

  virtual void Destroy() {
    uv_close(reinterpret_cast<uv_handle_t*>(m_async), AsyncClose_);
  }

 private:
  void Execute() {
    ExecutionMessageBus message_bus(this);
    Execute(message_bus);
  }

  void Produce_(RdKafka::Message* m) {
    scoped_mutex_lock lock(m_async_lock);
    m_asyncdata.push_back(m);
    uv_async_send(m_async);
  }

  void ProduceWarning_(RdKafka::ErrorCode c) {
    scoped_mutex_lock lock(m_async_lock);
    m_asyncwarning.push_back(c);
    uv_async_send(m_async);
  }

  NAN_INLINE static NAUV_WORK_CB(m_async_message) {
    MessageWorker *worker = static_cast<MessageWorker*>(async->data);
    worker->WorkMessage();
  }

  NAN_INLINE static void AsyncClose_(uv_handle_t* handle) {
    MessageWorker *worker = static_cast<MessageWorker*>(handle->data);
    delete reinterpret_cast<uv_async_t*>(handle);
    delete worker;
  }

  uv_async_t *m_async;
  uv_mutex_t m_async_lock;
  std::vector<RdKafka::Message*> m_asyncdata;
  std::vector<RdKafka::ErrorCode> m_asyncwarning;
};

namespace Handle {
class OffsetsForTimes : public ErrorAwareWorker {
 public:
  OffsetsForTimes(Nan::Callback*, NodeKafka::Connection*,
    std::vector<RdKafka::TopicPartition*> &,
    const int &);
  ~OffsetsForTimes();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Connection * m_handle;
  std::vector<RdKafka::TopicPartition*> m_topic_partitions;
  const int m_timeout_ms;
};
}  // namespace Handle

class ConnectionMetadata : public ErrorAwareWorker {
 public:
  ConnectionMetadata(Nan::Callback*, NodeKafka::Connection*,
    std::string, int, bool);
  ~ConnectionMetadata();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Connection * m_connection;
  std::string m_topic;
  int m_timeout_ms;
  bool m_all_topics;

  RdKafka::Metadata* m_metadata;
};

class ConnectionQueryWatermarkOffsets : public ErrorAwareWorker {
 public:
  ConnectionQueryWatermarkOffsets(Nan::Callback*, NodeKafka::Connection*,
    std::string, int32_t, int);
  ~ConnectionQueryWatermarkOffsets();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Connection * m_connection;
  std::string m_topic;
  int32_t m_partition;
  int m_timeout_ms;

  int64_t m_high_offset;
  int64_t m_low_offset;
};

class ProducerConnect : public ErrorAwareWorker {
 public:
  ProducerConnect(Nan::Callback*, NodeKafka::Producer*);
  ~ProducerConnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
};

class ProducerDisconnect : public ErrorAwareWorker {
 public:
  ProducerDisconnect(Nan::Callback*, NodeKafka::Producer*);
  ~ProducerDisconnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
};

class ProducerFlush : public ErrorAwareWorker {
 public:
  ProducerFlush(Nan::Callback*, NodeKafka::Producer*, int);
  ~ProducerFlush();

  void Execute();
  void HandleOKCallback();

 private:
  NodeKafka::Producer * producer;
  int timeout_ms;
};

class ProducerInitTransactions : public ErrorAwareWorker {
 public:
  ProducerInitTransactions(Nan::Callback*, NodeKafka::Producer*, const int &);
  ~ProducerInitTransactions();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
  const int m_timeout_ms;
};

class ProducerBeginTransaction : public ErrorAwareWorker {
 public:
  ProducerBeginTransaction(Nan::Callback*, NodeKafka::Producer*);
  ~ProducerBeginTransaction();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
};

class ProducerCommitTransaction : public ErrorAwareWorker {
 public:
  ProducerCommitTransaction(Nan::Callback*, NodeKafka::Producer*, const int &);
  ~ProducerCommitTransaction();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
  const int m_timeout_ms;
};

class ProducerAbortTransaction : public ErrorAwareWorker {
 public:
  ProducerAbortTransaction(Nan::Callback*, NodeKafka::Producer*, const int &);
  ~ProducerAbortTransaction();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
  const int m_timeout_ms;
};

class ProducerSendOffsetsToTransaction : public ErrorAwareWorker {
 public:
  ProducerSendOffsetsToTransaction(
    Nan::Callback*, NodeKafka::Producer*,
    std::vector<RdKafka::TopicPartition*> &,
    KafkaConsumer*,
    const int &);
  ~ProducerSendOffsetsToTransaction();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::Producer * producer;
  std::vector<RdKafka::TopicPartition*> m_topic_partitions;
  NodeKafka::KafkaConsumer* consumer;
  const int m_timeout_ms;
};

class KafkaConsumerConnect : public ErrorAwareWorker {
 public:
  KafkaConsumerConnect(Nan::Callback*, NodeKafka::KafkaConsumer*);
  ~KafkaConsumerConnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::KafkaConsumer * consumer;
};

class KafkaConsumerDisconnect : public ErrorAwareWorker {
 public:
  KafkaConsumerDisconnect(Nan::Callback*, NodeKafka::KafkaConsumer*);
  ~KafkaConsumerDisconnect();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::KafkaConsumer * consumer;
};

class KafkaConsumerConsumeLoop : public MessageWorker {
 public:
  KafkaConsumerConsumeLoop(Nan::Callback*,
    NodeKafka::KafkaConsumer*, const int &, const int &);
  ~KafkaConsumerConsumeLoop();

  static void ConsumeLoop(void *arg);
  void Close();
  void Execute(const ExecutionMessageBus&);
  void HandleOKCallback();
  void HandleErrorCallback();
  void HandleMessageCallback(RdKafka::Message*, RdKafka::ErrorCode);
 private:
  uv_thread_t thread_event_loop;
  NodeKafka::KafkaConsumer* consumer;
  const int m_timeout_ms;
  unsigned int m_rand_seed;
  const int m_timeout_sleep_delay_ms;
  bool m_looping;
};

class KafkaConsumerConsume : public ErrorAwareWorker {
 public:
  KafkaConsumerConsume(Nan::Callback*, NodeKafka::KafkaConsumer*, const int &);
  ~KafkaConsumerConsume();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::KafkaConsumer * consumer;
  const int m_timeout_ms;
  RdKafka::Message* m_message;
};

class KafkaConsumerCommitted : public ErrorAwareWorker {
 public:
  KafkaConsumerCommitted(Nan::Callback*,
    NodeKafka::KafkaConsumer*, std::vector<RdKafka::TopicPartition*> &,
    const int &);
  ~KafkaConsumerCommitted();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::KafkaConsumer * m_consumer;
  std::vector<RdKafka::TopicPartition*> m_topic_partitions;
  const int m_timeout_ms;
};

class KafkaConsumerCommitCb : public ErrorAwareWorker {
 public:
  KafkaConsumerCommitCb(Nan::Callback*,
    NodeKafka::KafkaConsumer*,
    std::optional<std::vector<RdKafka::TopicPartition*>> &);
  ~KafkaConsumerCommitCb();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::KafkaConsumer * m_consumer;
  std::optional<std::vector<RdKafka::TopicPartition*>> m_topic_partitions;
};

class KafkaConsumerSeek : public ErrorAwareWorker {
 public:
  KafkaConsumerSeek(Nan::Callback*, NodeKafka::KafkaConsumer*,
    const RdKafka::TopicPartition *, const int &);
  ~KafkaConsumerSeek();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::KafkaConsumer * m_consumer;
  const RdKafka::TopicPartition * m_toppar;
  const int m_timeout_ms;
};

class KafkaConsumerConsumeNum : public ErrorAwareWorker {
 public:
  KafkaConsumerConsumeNum(Nan::Callback*, NodeKafka::KafkaConsumer*,
    const uint32_t &, const int &, bool);
  ~KafkaConsumerConsumeNum();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::KafkaConsumer * m_consumer;
  const uint32_t m_num_messages;
  const int m_timeout_ms;
  const bool m_timeout_only_for_first_message;
  std::vector<RdKafka::Message*> m_messages;
};

/**
 * @brief Create a kafka topic on a remote broker cluster
 */
class AdminClientCreateTopic : public ErrorAwareWorker {
 public:
  AdminClientCreateTopic(Nan::Callback*, NodeKafka::AdminClient*,
    rd_kafka_NewTopic_t*, const int &);
  ~AdminClientCreateTopic();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::AdminClient * m_client;
  rd_kafka_NewTopic_t* m_topic;
  const int m_timeout_ms;
};

/**
 * @brief Delete a kafka topic on a remote broker cluster
 */
class AdminClientDeleteTopic : public ErrorAwareWorker {
 public:
  AdminClientDeleteTopic(Nan::Callback*, NodeKafka::AdminClient*,
    rd_kafka_DeleteTopic_t*, const int &);
  ~AdminClientDeleteTopic();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::AdminClient * m_client;
  rd_kafka_DeleteTopic_t* m_topic;
  const int m_timeout_ms;
};

/**
 * @brief Delete a kafka topic on a remote broker cluster
 */
class AdminClientCreatePartitions : public ErrorAwareWorker {
 public:
  AdminClientCreatePartitions(Nan::Callback*, NodeKafka::AdminClient*,
    rd_kafka_NewPartitions_t*, const int &);
  ~AdminClientCreatePartitions();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();
 private:
  NodeKafka::AdminClient * m_client;
  rd_kafka_NewPartitions_t* m_partitions;
  const int m_timeout_ms;
};

/**
 * @brief List consumer groups on a remote broker cluster.
 */
class AdminClientListGroups : public ErrorAwareWorker {
 public:
  AdminClientListGroups(Nan::Callback *, NodeKafka::AdminClient *, bool,
                        std::vector<rd_kafka_consumer_group_state_t> &,
                        bool,
                        std::vector<rd_kafka_consumer_group_type_t> &,
                        const int &);
  ~AdminClientListGroups();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  const bool m_is_match_states_set;
  std::vector<rd_kafka_consumer_group_state_t> m_match_states;
  const bool m_is_match_types_set;
  std::vector<rd_kafka_consumer_group_type_t> m_match_types;
  const int m_timeout_ms;
  rd_kafka_event_t *m_event_response;
};

/**
 * @brief Describe consumer groups on a remote broker cluster.
 */
class AdminClientDescribeGroups : public ErrorAwareWorker {
 public:
  AdminClientDescribeGroups(Nan::Callback *, NodeKafka::AdminClient *,
                            std::vector<std::string> &, bool, const int &);
  ~AdminClientDescribeGroups();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  std::vector<std::string> m_groups;
  const bool m_include_authorized_operations;
  const int m_timeout_ms;
  rd_kafka_event_t *m_event_response;
};

/**
 * @brief Delete consumer groups on a remote broker cluster.
 */
class AdminClientDeleteGroups : public ErrorAwareWorker {
 public:
  AdminClientDeleteGroups(Nan::Callback *, NodeKafka::AdminClient *,
                            rd_kafka_DeleteGroup_t **, size_t, const int &);
  ~AdminClientDeleteGroups();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  rd_kafka_DeleteGroup_t **m_group_list;
  size_t m_group_cnt;
  const int m_timeout_ms;
  rd_kafka_event_t *m_event_response;
};

/**
 * @brief List consumer group offsets on a remote broker cluster.
 */
class AdminClientListConsumerGroupOffsets : public ErrorAwareWorker {
 public:
  AdminClientListConsumerGroupOffsets(Nan::Callback *, NodeKafka::AdminClient *,
                          rd_kafka_ListConsumerGroupOffsets_t **, size_t, bool,
                          const int &);
  ~AdminClientListConsumerGroupOffsets();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  rd_kafka_ListConsumerGroupOffsets_t **m_req;
  size_t m_req_cnt;
  const bool m_require_stable_offsets;
  const int m_timeout_ms;
  rd_kafka_event_t *m_event_response;
};

/**
 * @brief Delete Records on a remote broker cluster.
 */
class AdminClientDeleteRecords : public ErrorAwareWorker {
 public:
  AdminClientDeleteRecords(Nan::Callback *, NodeKafka::AdminClient *,
                           rd_kafka_DeleteRecords_t **, size_t, const int &,
                           const int &);
  ~AdminClientDeleteRecords();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  rd_kafka_DeleteRecords_t **m_del_records;
  size_t m_del_records_cnt;
  const int m_operation_timeout_ms;
  const int m_timeout_ms;
  rd_kafka_event_t *m_event_response;
};

/**
 * @brief Describe Topics on a remote broker cluster.
 */
class AdminClientDescribeTopics : public ErrorAwareWorker {
 public:
  AdminClientDescribeTopics(Nan::Callback *, NodeKafka::AdminClient *,
                            rd_kafka_TopicCollection_t *, const bool,
                            const int &);
  ~AdminClientDescribeTopics();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  rd_kafka_TopicCollection_t *m_topics;
  const bool m_include_authorized_operations;
  const int m_timeout_ms;
  rd_kafka_event_t *m_event_response;
};

/**
 * @brief List Offsets on a remote broker cluster.
 */
class AdminClientListOffsets : public ErrorAwareWorker {
 public:
  AdminClientListOffsets(Nan::Callback *, NodeKafka::AdminClient *,
                         rd_kafka_topic_partition_list_t *, const int &,
                         rd_kafka_IsolationLevel_t);
  ~AdminClientListOffsets();

  void Execute();
  void HandleOKCallback();
  void HandleErrorCallback();

 private:
  NodeKafka::AdminClient *m_client;
  rd_kafka_topic_partition_list_t *m_partitions;
  const int m_timeout_ms;
  const rd_kafka_IsolationLevel_t m_isolation_level;
  rd_kafka_event_t *m_event_response;
};

}  // namespace Workers

}  // namespace NodeKafka

#endif  // SRC_WORKERS_H_
