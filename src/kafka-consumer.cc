/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <iostream>
#include <string>
#include <vector>

#include "src/errors.h"
#include "src/kafka-consumer.h"
#include "src/workers.h"

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

KafkaConsumer::KafkaConsumer(const Napi::CallbackInfo& info): Connection<KafkaConsumer>(info) {
  Napi::Env env = info.Env();
  if (!info.IsConstructCall()) {
    Napi::Error::New(env, "non-constructor invocation not supported").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 2) {
    Napi::Error::New(env, "You must supply global and topic configuration").ThrowAsJavaScriptException();
    return;
  }

  if (!info[0].IsObject()) {
    Napi::Error::New(env, "Global configuration data must be specified").ThrowAsJavaScriptException();
    return;
  }

  std::string errstr;

  Napi::Object i1 = info[0].ToObject();

  Conf* gconfig =
    Conf::create(RdKafka::Conf::CONF_GLOBAL, info[0].ToObject(), errstr);

  if (!gconfig) {
    Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
    return;
  }

  // If tconfig isn't set, then just let us pick properties from gconf.
  Conf* tconfig = nullptr;
  if (info[1].IsObject()) {
    tconfig = Conf::create(RdKafka::Conf::CONF_TOPIC, info[1].ToObject(), errstr);

    if (!tconfig) {
      delete gconfig;
      Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
      return;
    }
  }

  this->Config(gconfig, tconfig);

  if (m_tconfig)
    m_gconfig->set("default_topic_conf", m_tconfig, errstr);

  m_consume_loop = nullptr;
}

KafkaConsumer::~KafkaConsumer() {
  // We only want to run this if it hasn't been run already
  Disconnect();
}

Baton KafkaConsumer::Connect() {
  if (IsConnected()) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  Baton baton = setupSaslOAuthBearerConfig();
  if (baton.err() != RdKafka::ERR_NO_ERROR) {
    return baton;
  }

  std::string errstr;
  {
    scoped_shared_write_lock lock(m_connection_lock);
    m_consumer = RdKafka::KafkaConsumer::create(m_gconfig, errstr);
    m_client = m_consumer;
  }

  if (!m_client || !errstr.empty()) {
    return Baton(RdKafka::ERR__STATE, errstr);
  }

  /* Set the client name at the first possible opportunity for logging. */
  m_event_cb.dispatcher.SetClientName(m_client->name());

  baton = setupSaslOAuthBearerBackgroundQueue();
  if (baton.err() != RdKafka::ERR_NO_ERROR) {
    return baton;
  }

  if (m_partitions.size() > 0) {
    m_client->resume(m_partitions);
  }

  rd_kafka_queue_t* queue = rd_kafka_queue_get_consumer(m_client->c_ptr());
  rd_kafka_queue_cb_event_enable(
      queue, &m_queue_not_empty_cb.queue_not_empty_cb, &m_queue_not_empty_cb);
  rd_kafka_queue_destroy(queue);

  return Baton(RdKafka::ERR_NO_ERROR);
}

void KafkaConsumer::ActivateDispatchers() {
  // Listen to global config
  m_gconfig->listen();

  // Listen to non global config
  // tconfig->listen();

  // This should be refactored to config based management
  m_event_cb.dispatcher.Activate();
  m_queue_not_empty_cb.dispatcher.Activate();
}

Baton KafkaConsumer::Disconnect() {
  // Only close client if it is connected
  RdKafka::ErrorCode err = RdKafka::ERR_NO_ERROR;

  if (IsConnected()) {
    m_is_closing = true;
    {
      scoped_shared_write_lock lock(m_connection_lock);

      err = m_consumer->close();

      delete m_client;
      m_client = NULL;
      m_consumer = nullptr;
    }
  }

  m_is_closing = false;

  return Baton(err);
}

void KafkaConsumer::DeactivateDispatchers() {
  // Stop listening to the config dispatchers
  m_gconfig->stop();

  // Also this one
  m_event_cb.dispatcher.Deactivate();
  m_queue_not_empty_cb.dispatcher.Deactivate();
}

void KafkaConsumer::ConfigureCallback(const std::string& string_key,
				      const Napi::Function& cb,
				      bool add) {
  if (string_key.compare("queue_non_empty_cb") == 0) {
    if (add) {
      this->m_queue_not_empty_cb.dispatcher.AddCallback(cb);
    } else {
      this->m_queue_not_empty_cb.dispatcher.RemoveCallback(cb);
    }
  } else {
    Connection::ConfigureCallback(string_key, cb, add);
  }
}

bool KafkaConsumer::IsSubscribed() {
  if (!IsConnected()) {
    return false;
  }

  if (!m_is_subscribed) {
    return false;
  }

  return true;
}


bool KafkaConsumer::HasAssignedPartitions() {
  return !m_partitions.empty();
}

int KafkaConsumer::AssignedPartitionCount() {
  return m_partition_cnt;
}

Baton KafkaConsumer::GetWatermarkOffsets(
  std::string topic_name, int32_t partition,
  int64_t* low_offset, int64_t* high_offset) {
  // Check if we are connected first

  RdKafka::ErrorCode err;

  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      // Always send true - we
      err = m_client->get_watermark_offsets(topic_name, partition,
	low_offset, high_offset);
    } else {
      err = RdKafka::ERR__STATE;
    }
  } else {
    err = RdKafka::ERR__STATE;
  }

  return Baton(err);
}

void KafkaConsumer::part_list_print(const std::vector<RdKafka::TopicPartition*> &partitions) {  // NOLINT
  for (unsigned int i = 0 ; i < partitions.size() ; i++)
    std::cerr << partitions[i]->topic() <<
      "[" << partitions[i]->partition() << "], ";
  std::cerr << std::endl;
}

Baton KafkaConsumer::Assign(std::vector<RdKafka::TopicPartition*> partitions) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is disconnected");
  }


  RdKafka::ErrorCode errcode = m_consumer->assign(partitions);

  if (errcode == RdKafka::ERR_NO_ERROR) {
    m_partition_cnt = partitions.size();
    m_partitions.swap(partitions);
  }

  // Destroy the partitions: Either we're using them (and partitions
  // is now our old vector), or we're not using it as there was an
  // error.
  RdKafka::TopicPartition::destroy(partitions);

  return Baton(errcode);
}

Baton KafkaConsumer::Unassign() {
  if (!IsClosing() && !IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::ErrorCode errcode = m_consumer->unassign();

  if (errcode != RdKafka::ERR_NO_ERROR) {
    return Baton(errcode);
  }

  // Destroy the old list of partitions since we are no longer using it
  RdKafka::TopicPartition::destroy(m_partitions);

  m_partition_cnt = 0;

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton KafkaConsumer::IncrementalAssign(
  std::vector<RdKafka::TopicPartition*> partitions) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is disconnected");
  }

  RdKafka::Error* error = m_consumer->incremental_assign(partitions);

  if (error == NULL) {
    m_partition_cnt += partitions.size();
    // We assume here that there are no duplicate assigns and just transfer.
    m_partitions.insert(m_partitions.end(), partitions.begin(), partitions.end()); // NOLINT
  } else {
    // If we're in error, destroy it, otherwise, don't (since we're using them).
    RdKafka::TopicPartition::destroy(partitions);
  }

  return rdkafkaErrorToBaton(error);
}

Baton KafkaConsumer::IncrementalUnassign(
  std::vector<RdKafka::TopicPartition*> partitions) {
  if (!IsClosing() && !IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Error* error = m_consumer->incremental_unassign(partitions);

  std::vector<RdKafka::TopicPartition*> delete_partitions;

  if (error == NULL) {
    // For now, use two for loops. Make more efficient if needed later.
    for (unsigned int i = 0; i < partitions.size(); i++) {
      for (unsigned int j = 0; j < m_partitions.size(); j++) {
	if (partitions[i]->partition() == m_partitions[j]->partition() &&
	    partitions[i]->topic() == m_partitions[j]->topic()) {
	  delete_partitions.push_back(m_partitions[j]);
	  m_partitions.erase(m_partitions.begin() + j);
	  m_partition_cnt--;
	  break;
	}
      }
    }
  }

  // Destroy the old list of partitions since we are no longer using it
  RdKafka::TopicPartition::destroy(delete_partitions);

  // Destroy the partition args since those are only used to lookup the
  // partitions that needed to be deleted.
  RdKafka::TopicPartition::destroy(partitions);

  return rdkafkaErrorToBaton(error);
}

Baton KafkaConsumer::Commit(std::vector<RdKafka::TopicPartition*> toppars) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::ErrorCode err = m_consumer->commitAsync(toppars);

  return Baton(err);
}

Baton KafkaConsumer::Commit(RdKafka::TopicPartition * toppar) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  // Need to put topic in a vector for it to work
  std::vector<RdKafka::TopicPartition*> offsets = {toppar};
  RdKafka::ErrorCode err = m_consumer->commitAsync(offsets);

  return Baton(err);
}

Baton KafkaConsumer::Commit() {
  // sets an error message
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  RdKafka::ErrorCode err = m_consumer->commitAsync();

  return Baton(err);
}

// Synchronous commit events
Baton KafkaConsumer::CommitSync(std::vector<RdKafka::TopicPartition*> toppars) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  RdKafka::ErrorCode err = m_consumer->commitSync(toppars);
  // RdKafka::TopicPartition::destroy(toppars);

  return Baton(err);
}

Baton KafkaConsumer::CommitSync(RdKafka::TopicPartition * toppar) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  // Need to put topic in a vector for it to work
  std::vector<RdKafka::TopicPartition*> offsets = {toppar};
  RdKafka::ErrorCode err = m_consumer->commitSync(offsets);

  return Baton(err);
}

Baton KafkaConsumer::CommitSync() {
  // sets an error message
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  RdKafka::ErrorCode err = m_consumer->commitSync();

  return Baton(err);
}

Baton KafkaConsumer::Seek(const RdKafka::TopicPartition &partition, int timeout_ms) {  // NOLINT
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  RdKafka::ErrorCode err = m_consumer->seek(partition, timeout_ms);

  return Baton(err);
}

Baton KafkaConsumer::Committed(std::vector<RdKafka::TopicPartition*> &toppars,
  int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  RdKafka::ErrorCode err = m_consumer->committed(toppars, timeout_ms);

  return Baton(err);
}

Baton KafkaConsumer::Position(std::vector<RdKafka::TopicPartition*> &toppars) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }

  RdKafka::ErrorCode err = m_consumer->position(toppars);

  return Baton(err);
}

Baton KafkaConsumer::Subscription() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Consumer is not connected");
  }

  // Needs to be a pointer since we're returning it through the baton
  std::vector<std::string> * topics = new std::vector<std::string>;

  RdKafka::ErrorCode err = m_consumer->subscription(*topics);

  if (err == RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Good to go
    return Baton(topics);
  }

  return Baton(err);
}

Baton KafkaConsumer::Unsubscribe() {
  if (IsConnected() && IsSubscribed()) {
    m_consumer->unsubscribe();
    m_is_subscribed = false;
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton KafkaConsumer::Pause(std::vector<RdKafka::TopicPartition*> & toppars) {
  if (IsConnected()) {
    RdKafka::ErrorCode err = m_consumer->pause(toppars);
    return Baton(err);
  }

  return Baton(RdKafka::ERR__STATE);
}

Baton KafkaConsumer::Resume(std::vector<RdKafka::TopicPartition*> & toppars) {
  if (IsConnected()) {
    RdKafka::ErrorCode err = m_consumer->resume(toppars);

    return Baton(err);
  }

  return Baton(RdKafka::ERR__STATE);
}

Baton KafkaConsumer::OffsetsStore(
    std::vector<RdKafka::TopicPartition*>& toppars) {  // NOLINT
  if (!IsSubscribed()) { /* IsSubscribed also checks IsConnected */
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::ErrorCode err = m_consumer->offsets_store(toppars);

  return Baton(err);
}

Baton KafkaConsumer::Subscribe(std::vector<std::string> topics) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::ErrorCode errcode = m_consumer->subscribe(topics);
  if (errcode != RdKafka::ERR_NO_ERROR) {
    return Baton(errcode);
  }

  m_is_subscribed = true;

  return Baton(RdKafka::ERR_NO_ERROR);
}

Baton KafkaConsumer::Consume(int timeout_ms) {
  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
    } else {
      RdKafka::Message * message = m_consumer->consume(timeout_ms);
      RdKafka::ErrorCode response_code = message->err();
      // we want to handle these errors at the call site
      if (response_code != RdKafka::ERR_NO_ERROR &&
	 response_code != RdKafka::ERR__PARTITION_EOF &&
	 response_code != RdKafka::ERR__TIMED_OUT &&
	 response_code != RdKafka::ERR__TIMED_OUT_QUEUE
       ) {
	delete message;
	return Baton(response_code);
      }

      return Baton(message);
    }
  } else {
    return Baton(RdKafka::ERR__STATE, "KafkaConsumer is not connected");
  }
}

Baton KafkaConsumer::RefreshAssignments() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  std::vector<RdKafka::TopicPartition*> partition_list;
  RdKafka::ErrorCode err = m_consumer->assignment(partition_list);

  switch (err) {
    case RdKafka::ERR_NO_ERROR:
      m_partition_cnt = partition_list.size();
      m_partitions.swap(partition_list);

      // These are pointers so we need to delete them somewhere.
      // Do it here because we're only going to convert when we're ready
      // to return to v8.
      RdKafka::TopicPartition::destroy(partition_list);
      return Baton(RdKafka::ERR_NO_ERROR);
    break;
    default:
      return Baton(err);
    break;
  }
}

Baton KafkaConsumer::AssignmentLost() {
  bool lost = m_consumer->assignment_lost();
  return Baton(reinterpret_cast<void *>(lost));
}

std::string KafkaConsumer::RebalanceProtocol() {
  if (!IsConnected()) {
    return std::string("NONE");
  }

  return m_consumer->rebalance_protocol();
}

Napi::FunctionReference KafkaConsumer::constructor;

void KafkaConsumer::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function KafkaConsumer = DefineClass(env, "KafkaConsumer", {
      /*
       * Lifecycle events inherited from NodeKafka::Connection
       *
       * @sa NodeKafka::Connection
       */

      InstanceMethod("configureCallbacks", &KafkaConsumer::NodeConfigureCallbacks),

      /*
       * @brief Methods to do with establishing state
       */
      InstanceMethod("connect", &KafkaConsumer::NodeConnect),
      InstanceMethod("disconnect", &KafkaConsumer::NodeDisconnect),
      InstanceMethod("getMetadata", &KafkaConsumer::NodeGetMetadata),
      InstanceMethod("queryWatermarkOffsets", &KafkaConsumer::NodeQueryWatermarkOffsets),  // NOLINT
      InstanceMethod("offsetsForTimes", &KafkaConsumer::NodeOffsetsForTimes),
      InstanceMethod("getWatermarkOffsets", &KafkaConsumer::NodeGetWatermarkOffsets),
      InstanceMethod("setSaslCredentials", &KafkaConsumer::NodeSetSaslCredentials),
      InstanceMethod("setOAuthBearerToken", &KafkaConsumer::NodeSetOAuthBearerToken),
      StaticMethod("setOAuthBearerTokenFailure", &KafkaConsumer::NodeSetOAuthBearerTokenFailure),

      /*
       * @brief Methods exposed to do with message retrieval
       */
      InstanceMethod("subscription", &KafkaConsumer::NodeSubscription),
      InstanceMethod("subscribe", &KafkaConsumer::NodeSubscribe),
      InstanceMethod("unsubscribe", &KafkaConsumer::NodeUnsubscribe),
      InstanceMethod("consumeLoop", &KafkaConsumer::NodeConsumeLoop),
      InstanceMethod("consume", &KafkaConsumer::NodeConsume),
      InstanceMethod("seek", &KafkaConsumer::NodeSeek),


      /**
       * @brief Pausing and resuming
       */
      InstanceMethod("pause", &KafkaConsumer::NodePause),
      InstanceMethod("resume", &KafkaConsumer::NodeResume),


      /*
       * @brief Methods to do with partition assignment / rebalancing
       */

      InstanceMethod("committed", &KafkaConsumer::NodeCommitted),
      InstanceMethod("position", &KafkaConsumer::NodePosition),
      InstanceMethod("assign", &KafkaConsumer::NodeAssign),
      InstanceMethod("unassign", &KafkaConsumer::NodeUnassign),
      InstanceMethod("incrementalAssign", &KafkaConsumer::NodeIncrementalAssign),
      InstanceMethod("incrementalUnassign", &KafkaConsumer::NodeIncrementalUnassign),
      InstanceMethod("assignments", &KafkaConsumer::NodeAssignments),
      InstanceMethod("assignmentLost", &KafkaConsumer::NodeAssignmentLost),
      InstanceMethod("rebalanceProtocol", &KafkaConsumer::NodeRebalanceProtocol),

      InstanceMethod("commit", &KafkaConsumer::NodeCommit),
      InstanceMethod("commitSync", &KafkaConsumer::NodeCommitSync),
      InstanceMethod("commitCb", &KafkaConsumer::NodeCommitCb),
      InstanceMethod("offsetsStore", &KafkaConsumer::NodeOffsetsStore),
      InstanceMethod("offsetsStoreSingle", &KafkaConsumer::NodeOffsetsStoreSingle),
    });

  constructor.Reset(KafkaConsumer);
  exports.Set(Napi::String::New(env, "KafkaConsumer"), KafkaConsumer);
}

// Napi::Object KafkaConsumer::NewInstance(Napi::Value arg) {
//   Napi::Env env = arg.Env();
//   Napi::EscapableHandleScope scope(env);

//   const unsigned argc = 1;

//   Napi::Value argv[argc] = { arg };
//   Napi::Function cons = Napi::Function::New(env, constructor);
//   Napi::Object instance =
//     Napi::NewInstance(cons, argc, argv);

//   return scope.Escape(instance);
// }

/* Node exposed methods */

Napi::Value KafkaConsumer::NodeCommitted(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[0].IsArray()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify an array of topic partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

  int timeout_ms;
  uint32_t maybeTimeout =
    info[1].As<Napi::Number>().Uint32Value();

  timeout_ms = static_cast<int>(maybeTimeout);

  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Napi::AsyncWorker *worker =
      new Workers::KafkaConsumerCommitted(callback, this, toppars, timeout_ms);

  worker->Queue();

  return env.Null();
}

Napi::Value KafkaConsumer::NodeSubscription(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Baton b = this->Subscription();

  if (b.err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return Napi::Number::New(env, error_code);
  }

  std::vector<std::string> * topics = b.data<std::vector<std::string>*>();

  return Conversion::Util::ToV8Array(*topics);

  delete topics;
}

Napi::Value KafkaConsumer::NodePosition(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsArray()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify an array of topic partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

  Baton b = this->Position(toppars);

  if (b.err() != RdKafka::ErrorCode::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return Napi::Number::New(env, error_code);
  }

  return
    Conversion::TopicPartition::ToV8Array(toppars);

  // Delete the underlying topic partitions
  RdKafka::TopicPartition::destroy(toppars);
}

Napi::Value KafkaConsumer::NodeAssignments(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);


  Baton b = this->RefreshAssignments();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return Napi::Number::New(env, error_code);
  }

  return
    Conversion::TopicPartition::ToV8Array(this->m_partitions);
}

Napi::Value KafkaConsumer::NodeAssignmentLost(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Baton b = this->AssignmentLost();

  bool lost = b.data<bool>();
  return Napi::Boolean::New(env, lost);
}

Napi::Value KafkaConsumer::NodeRebalanceProtocol(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  std::string protocol = this->RebalanceProtocol();
  return Napi::String::New(env, protocol);
}

Napi::Value KafkaConsumer::NodeAssign(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsArray()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify an array of partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array partitions = info[0].As<Napi::Array>();
  std::vector<RdKafka::TopicPartition*> topic_partitions;

  for (unsigned int i = 0; i < partitions.Length(); ++i) {
    Napi::Value partition_obj_value = partitions.Get(i);
    if (!partition_obj_value.IsObject()) {
      Napi::Error::New(env, "Must pass topic-partition objects").ThrowAsJavaScriptException();
    }

    Napi::Object partition_obj = partition_obj_value.As<Napi::Object>();

    // Got the object
    int64_t partition = GetParameter<int64_t>(partition_obj, "partition", -1);
    std::string topic = GetParameter<std::string>(partition_obj, "topic", "");

    if (!topic.empty()) {
      RdKafka::TopicPartition* part;

      if (partition < 0) {
	part = Connection::GetPartition(topic);
      } else {
	part = Connection::GetPartition(topic, partition);
      }

      // Set the default value to offset invalid. If provided, we will not set
      // the offset.
      int64_t offset = GetParameter<int64_t>(
	partition_obj, "offset", RdKafka::Topic::OFFSET_INVALID);
      if (offset != RdKafka::Topic::OFFSET_INVALID) {
	part->set_offset(offset);
      }

      topic_partitions.push_back(part);
    }
  }

  // Hand over the partitions to the consumer.
  Baton b = this->Assign(topic_partitions);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    Napi::Error::New(env, RdKafka::err2str(b.err()).c_str()).ThrowAsJavaScriptException();

  }

  return Napi::Value::From(env, true);
}

Napi::Value KafkaConsumer::NodeUnassign(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!this->IsClosing() && !this->IsConnected()) {
    Napi::Error::New(env, "KafkaConsumer is disconnected").ThrowAsJavaScriptException();
    return env.Null();
  }

  Baton b = this->Unassign();

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    Napi::Error::New(env, RdKafka::err2str(b.err()).c_str()).ThrowAsJavaScriptException();

  }

  return Napi::Value::From(env, true);
}

Napi::Value KafkaConsumer::NodeIncrementalAssign(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsArray()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify an array of partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array partitions = info[0].As<Napi::Array>();
  std::vector<RdKafka::TopicPartition*> topic_partitions;

  for (unsigned int i = 0; i < partitions.Length(); ++i) {
    Napi::Value partition_obj_value = partitions.Get(i);
    if (!partition_obj_value.IsObject()) {
      Napi::Error::New(env, "Must pass topic-partition objects").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object partition_obj = partition_obj_value.As<Napi::Object>();

    // Got the object
    int64_t partition = GetParameter<int64_t>(partition_obj, "partition", -1);
    std::string topic = GetParameter<std::string>(partition_obj, "topic", "");

    if (!topic.empty()) {
      RdKafka::TopicPartition* part;

      if (partition < 0) {
	part = Connection::GetPartition(topic);
      } else {
	part = Connection::GetPartition(topic, partition);
      }

      // Set the default value to offset invalid. If provided, we will not set
      // the offset.
      int64_t offset = GetParameter<int64_t>(
	partition_obj, "offset", RdKafka::Topic::OFFSET_INVALID);
      if (offset != RdKafka::Topic::OFFSET_INVALID) {
	part->set_offset(offset);
      }

      topic_partitions.push_back(part);
    }
  }

  // Hand over the partitions to the consumer.
  Baton b = this->IncrementalAssign(topic_partitions);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    b.ToError(env).ThrowAsJavaScriptException();
  }

  return Napi::Value::From(env, true);
}

Napi::Value KafkaConsumer::NodeIncrementalUnassign(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsArray()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify an array of partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array partitions = info[0].As<Napi::Array>();
  std::vector<RdKafka::TopicPartition*> topic_partitions;

  for (unsigned int i = 0; i < partitions.Length(); ++i) {
    Napi::Value partition_obj_value = partitions.Get(i);
    if (!partition_obj_value.IsObject()) {
      Napi::Error::New(env, "Must pass topic-partition objects").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object partition_obj = partition_obj_value.As<Napi::Object>();

    // Got the object
    int64_t partition = GetParameter<int64_t>(partition_obj, "partition", -1);
    std::string topic = GetParameter<std::string>(partition_obj, "topic", "");

    if (!topic.empty()) {
      RdKafka::TopicPartition* part;

      if (partition < 0) {
	part = Connection::GetPartition(topic);
      } else {
	part = Connection::GetPartition(topic, partition);
      }

      // Set the default value to offset invalid. If provided, we will not set
      // the offset.
      int64_t offset = GetParameter<int64_t>(
	partition_obj, "offset", RdKafka::Topic::OFFSET_INVALID);
      if (offset != RdKafka::Topic::OFFSET_INVALID) {
	part->set_offset(offset);
      }

      topic_partitions.push_back(part);
    }
  }

  // Hand over the partitions to the consumer.
  Baton b = this->IncrementalUnassign(topic_partitions);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    Napi::Error errorObject = b.ToError(env);
    errorObject.ThrowAsJavaScriptException();

  }

  return Napi::Value::From(env, true);
}


Napi::Value KafkaConsumer::NodeUnsubscribe(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Baton b = this->Unsubscribe();

  return Napi::Value::From(env, b.err());
}

Napi::Value KafkaConsumer::NodeCommit(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  int error_code;


  if (!this->IsConnected()) {
    Napi::Error::New(env, "KafkaConsumer is disconnected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info[0].IsNull() || info[0].IsUndefined()) {
    Baton b = this->Commit();
    error_code = static_cast<int>(b.err());
  } else if (info[0].IsArray()) {
    std::vector<RdKafka::TopicPartition *> toppars =
      Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

    Baton b = this->Commit(toppars);
    error_code = static_cast<int>(b.err());

    RdKafka::TopicPartition::destroy(toppars);
  } else if (info[0].IsObject()) {
    RdKafka::TopicPartition * toppar =
      Conversion::TopicPartition::FromV8Object(info[0].As<Napi::Object>());

    if (toppar == NULL) {
      Napi::Error::New(env, "Invalid topic partition provided").ThrowAsJavaScriptException();
      return env.Null();
    }

    Baton b = this->Commit(toppar);
    error_code = static_cast<int>(b.err());

    delete toppar;
  } else {
    Napi::Error::New(env, "First parameter must be an object or an array").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Number::New(env, error_code);
}

Napi::Value KafkaConsumer::NodeCommitSync(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  int error_code;

  if (!this->IsConnected()) {
    Napi::Error::New(env, "KafkaConsumer is disconnected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info[0].IsNull() || info[0].IsUndefined()) {
    Baton b = this->CommitSync();
    error_code = static_cast<int>(b.err());
  } else if (info[0].IsArray()) {
    std::vector<RdKafka::TopicPartition *> toppars =
      Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

    Baton b = this->CommitSync(toppars);
    error_code = static_cast<int>(b.err());

    RdKafka::TopicPartition::destroy(toppars);
  } else if (info[0].IsObject()) {
    RdKafka::TopicPartition * toppar =
      Conversion::TopicPartition::FromV8Object(info[0].As<Napi::Object>());

    if (toppar == NULL) {
      Napi::Error::New(env, "Invalid topic partition provided").ThrowAsJavaScriptException();
      return env.Null();
    }

    Baton b = this->CommitSync(toppar);
    error_code = static_cast<int>(b.err());

    delete toppar;
  } else {
    Napi::Error::New(env, "First parameter must be an object or an array").ThrowAsJavaScriptException();
    return env.Null();
  }

  return Napi::Number::New(env, error_code);
}

Napi::Value KafkaConsumer::NodeCommitCb(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  int error_code;
  std::optional<std::vector<RdKafka::TopicPartition *>> toppars = std::nullopt;
  Napi::FunctionReference *callback;

  if (!this->IsConnected()) {
    Napi::Error::New(env, "KafkaConsumer is disconnected").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info.Length() != 2) {
    Napi::Error::New(env, "Two arguments are required").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!(
      (info[0].IsArray() || info[0].IsNull()) &&
      info[1].IsFunction())) {
    Napi::Error::New(env,
		     "First argument should be an array or null and second one a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info[0].IsArray()) {
    toppars =
      Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());
  }

  callback = new Napi::FunctionReference();
  callback->Reset(info[1].As<Napi::Function>());


  Workers::KafkaConsumerCommitCb *worker =
      new Workers::KafkaConsumerCommitCb(callback, this, toppars);

  worker->Queue();

  return env.Null();
}

Napi::Value KafkaConsumer::NodeSubscribe(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsArray()) {
    // Just throw an exception
    Napi::Error::New(env, "First parameter must be an array").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array topicsArray = info[0].As<Napi::Array>();
  std::vector<std::string> topics =
      Conversion::Util::ToStringVector(topicsArray);

  Baton b = this->Subscribe(topics);

  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

Napi::Value KafkaConsumer::NodeSeek(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If number of parameters is less than 3 (need topic partition, timeout,
  // and callback), we can't call this thing
  if (info.Length() < 3) {
    Napi::Error::New(env, "Must provide a topic partition, timeout, and callback").ThrowAsJavaScriptException();
    return env.Null();  // NOLINT
  }

  if (!info[0].IsObject()) {
    Napi::Error::New(env, "Topic partition must be an object").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsNumber() && !info[1].IsNull()) {
    Napi::Error::New(env, "Timeout must be a number.").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[2].IsFunction()) {
    Napi::Error::New(env, "Callback must be a function").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms;
  // Nan::Maybe<uint32_t> maybeTimeout =
  //   Nan::To<uint32_t>(info[1].As<v8::Number>());
  uint32_t maybeTimeout =
    info[1].As<Napi::Number>().Uint32Value();


  timeout_ms = static_cast<int>(maybeTimeout);
  // Do not allow timeouts of less than 10. Providing 0 causes segfaults
  // because it makes it asynchronous.
  if (timeout_ms < 10) {
    timeout_ms = 10;

  }

  const RdKafka::TopicPartition * toppar =
    Conversion::TopicPartition::FromV8Object(info[0].As<Napi::Object>());

  if (!toppar) {
    Napi::Error::New(env, "Invalid topic partition provided").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::FunctionReference *callback = new Napi::FunctionReference();

  callback->Reset(info[2].As<Napi::Function>());

  Napi::AsyncWorker *worker =
      new Workers::KafkaConsumerSeek(callback, this, toppar, timeout_ms);

  worker->Queue();

  return env.Null();
}

Napi::Value KafkaConsumer::NodeOffsetsStore(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If number of parameters is less than 3 (need topic partition, timeout,
  // and callback), we can't call this thing
  if (info.Length() < 1) {
    Napi::Error::New(env, "Must provide a list of topic partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Topic partition must be an array of objects").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

  Baton b = this->OffsetsStore(toppars);
  RdKafka::TopicPartition::destroy(toppars);

  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

Napi::Value
KafkaConsumer::NodeOffsetsStoreSingle(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If number of parameters is less than 3 (need topic partition, partition,
  // offset, and leader epoch), we can't call this.
  if (info.Length() < 4) {
    Napi::Error::New(env,
		     "Must provide topic, partition, offset and leaderEpoch")
	.ThrowAsJavaScriptException();
    return env.Null();
  }

  // Get string pointer for the topic name
  std::string topicUTF8 = info[0].As<Napi::String>().Utf8Value();
  const std::string& topic_name(topicUTF8);

  int64_t partition = info[1].As<Napi::Number>().Int64Value();
  int64_t offset = info[2].As<Napi::Number>().Int64Value();
  int64_t leader_epoch = info[3].As<Napi::Number>().Int64Value();

  RdKafka::TopicPartition* toppar =
      RdKafka::TopicPartition::create(topic_name, partition, offset);
  toppar->set_leader_epoch(leader_epoch);
  std::vector<RdKafka::TopicPartition*> toppars = {toppar};

  Baton b = this->OffsetsStore(toppars);

  delete toppar;

  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

Napi::Value KafkaConsumer::NodePause(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If number of parameters is less than 3 (need topic partition, timeout,
  // and callback), we can't call this thing
  if (info.Length() < 1) {
    Napi::Error::New(env, "Must provide a list of topic partitions").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Topic partition must be an array of objects").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

  Baton b = this->Pause(toppars);
  RdKafka::TopicPartition::destroy(toppars);

  #if 0
  // Now iterate through and delete these toppars
  for (std::vector<RdKafka::TopicPartition *>::const_iterator it = toppars.begin();  // NOLINT
       it != toppars.end(); it++) {
    RdKafka::TopicPartition* toppar = *it;
    if (toppar->err() != RdKafka::ERR_NO_ERROR) {
      // Need to somehow transmit this information.
      // @TODO(webmakersteve)
    }
    delete toppar;
  }
  #endif

  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

Napi::Value KafkaConsumer::NodeResume(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // If number of parameters is less than 3 (need topic partition, timeout,
  // and callback), we can't call this thing
  if (info.Length() < 1) {
    Napi::Error::New(env, "Must provide a list of topic partitions").ThrowAsJavaScriptException();
    return env.Null();  // NOLINT
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Topic partition must be an array of objects").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

  Baton b = this->Resume(toppars);

  // Now iterate through and delete these toppars
  for (std::vector<RdKafka::TopicPartition *>::const_iterator it = toppars.begin();  // NOLINT
       it != toppars.end(); it++) {
    RdKafka::TopicPartition* toppar = *it;
    if (toppar->err() != RdKafka::ERR_NO_ERROR) {
      // Need to somehow transmit this information.
      // @TODO(webmakersteve)
    }
    delete toppar;
  }

  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

Napi::Value KafkaConsumer::NodeConsumeLoop(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3) {
    // Just throw an exception
    Napi::Error::New(env, "Invalid number of parameters").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    Napi::Error::New(env, "Need to specify a timeout").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsNumber()) {
    Napi::Error::New(env, "Need to specify a sleep delay").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[2].IsFunction()) {
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms;
  uint32_t maybeTimeout =
    info[0].As<Napi::Number>().Uint32Value();
    timeout_ms = static_cast<int>(maybeTimeout);

  int timeout_sleep_delay_ms;
  uint32_t maybeSleep =
    info[1].As<Napi::Number>().Uint32Value();

  timeout_sleep_delay_ms = static_cast<int>(maybeSleep);

  if (this->m_consume_loop != nullptr) {
    Napi::Error::New(env, "Consume was already called").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!this->IsConnected()) {
    Napi::Error::New(env, "Connect must be called before consume").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Function cb = info[2].As<Napi::Function>();

  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  this->m_consume_loop =
    new Workers::KafkaConsumerConsumeLoop(callback, this, timeout_ms, timeout_sleep_delay_ms); // NOLINT

  return env.Null();
}

Napi::Value KafkaConsumer::NodeConsume(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2) {
    // Just throw an exception
    Napi::Error::New(env, "Invalid number of parameters").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms;
  uint32_t maybeTimeout =
    info[0].As<Napi::Number>().Uint32Value();

  timeout_ms = static_cast<int>(maybeTimeout);

  if (info[1].IsNumber()) {
    if (!info[2].IsBoolean()) {
      Napi::Error::New(env, "Need to specify a boolean").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[3].IsFunction()) {
      Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Number numMessagesNumber = info[1].As<Napi::Number>();
    uint32_t numMessages = numMessagesNumber.As<Napi::Number>().Uint32Value();  // NOLINT

    if (numMessages == 0) {
      Napi::Error::New(env, "Parameter must be a number over 0").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Boolean isTimeoutOnlyForFirstMessageBoolean = info[2].As<Napi::Boolean>(); // NOLINT
    bool isTimeoutOnlyForFirstMessage =
      isTimeoutOnlyForFirstMessageBoolean.As<Napi::Boolean>().Value();

    Napi::Function cb = info[3].As<Napi::Function>();
    Napi::FunctionReference *callback = new Napi::FunctionReference();
    callback->Reset(cb);

    Napi::AsyncWorker *worker = new Workers::KafkaConsumerConsumeNum(
	callback, this, numMessages, timeout_ms, isTimeoutOnlyForFirstMessage);
    worker->Queue();
  } else {
    if (!info[1].IsFunction()) {
      Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Function cb = info[1].As<Napi::Function>();
    Napi::FunctionReference *callback = new Napi::FunctionReference();
    callback->Reset(cb);

    Napi::AsyncWorker* worker = new Workers::KafkaConsumerConsume(callback, this, timeout_ms);
    worker->Queue();
  }

  return env.Null();
}

Napi::Value KafkaConsumer::NodeConnect(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Activate the dispatchers before the connection, as some callbacks may run
  // on the background thread.
  // We will deactivate them if the connection fails.
  this->ActivateDispatchers();

  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(info[0].As<Napi::Function>());
  Napi::AsyncWorker* worker = new Workers::KafkaConsumerConnect(callback, this);
  worker->Queue();
  return env.Null();
}

Napi::Value KafkaConsumer::NodeDisconnect(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Function cb = info[0].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Workers::KafkaConsumerConsumeLoop* consumeLoop =
    (Workers::KafkaConsumerConsumeLoop*)this->m_consume_loop;
  if (consumeLoop != nullptr) {
    // stop the consume loop
    consumeLoop->Close();

    // cleanup the async worker
    //    consumeLoop->WorkComplete();
    consumeLoop->Destroy();

    this->m_consume_loop = nullptr;
  }

  Napi::AsyncWorker* worker = new Workers::KafkaConsumerDisconnect(callback, this);

  worker->Queue();
  return env.Null();
}

Napi::Value KafkaConsumer::NodeGetWatermarkOffsets(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!info[0].IsString()) {
    Napi::Error::New(env, "1st parameter must be a topic string").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsNumber()) {
    Napi::Error::New(env, "2nd parameter must be a partition number").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Get string pointer for the topic name
  std::string topicUTF8 = info[0].As<Napi::String>().Utf8Value();
  // The first parameter is the topic
  std::string topic_name(topicUTF8);

  // Second parameter is the partition
  int32_t partition = info[1].As<Napi::Number>().Int32Value();

  // Set these ints which will store the return data
  int64_t low_offset;
  int64_t high_offset;

  Baton b = this->GetWatermarkOffsets(
    topic_name, partition, &low_offset, &high_offset);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    // Let the JS library throw if we need to so the error can be more rich
    int error_code = static_cast<int>(b.err());
    return Napi::Number::New(env, error_code);
  } else {
    Napi::Object offsetsObj = Napi::Object::New(env);
    (offsetsObj).Set(Napi::String::New(env, "lowOffset"),
      Napi::Number::New(env, low_offset));
    (offsetsObj).Set(Napi::String::New(env, "highOffset"),
      Napi::Number::New(env, high_offset));

    return offsetsObj;
  }
}

}  // namespace NodeKafka
