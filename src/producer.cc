/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>
#include <vector>

#include "src/producer.h"
#include "src/kafka-consumer.h"
#include "src/workers.h"

namespace NodeKafka {

/**
 * @brief Producer v8 wrapped object.
 *
 * Wraps the RdKafka::Producer object with compositional inheritence and
 * provides methods for interacting with it exposed to node.
 *
 * The base wrappable RdKafka::Handle deals with most of the wrapping but
 * we still need to declare its prototype.
 *
 * @sa RdKafka::Producer
 * @sa NodeKafka::Connection
 */

Producer::Producer(const Napi::CallbackInfo &info)
  : Connection(info), m_dr_cb(), m_partitioner_cb(),
    m_is_background_polling(false) {

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

  Conf* gconfig =
    Conf::create(RdKafka::Conf::CONF_GLOBAL,
		 (info[0].ToObject()), errstr);

  if (!gconfig) {
    Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
    return;
  }

  // If tconfig isn't set, then just let us pick properties from gconf.
  Conf* tconfig = nullptr;
  if (info[1].IsObject()) {
    tconfig = Conf::create(
			   RdKafka::Conf::CONF_TOPIC,
			   (info[1].ToObject()), errstr);

    if (!tconfig) {
      // No longer need this since we aren't instantiating anything
      delete gconfig;
      Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
      return;
    }
  }

  this->Config(gconfig, tconfig);

  if (m_tconfig)
    m_gconfig->set("default_topic_conf", m_tconfig, errstr);

  m_gconfig->set("dr_cb", &m_dr_cb, errstr);
}

Producer::~Producer() {
  Disconnect();
}

Napi::FunctionReference Producer::constructor;

void Producer::Init(const Napi::Env& env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function Producer = DefineClass(env, "Producer", {
      /*
       * Lifecycle events inherited from NodeKafka::Connection
       *
       * @sa NodeKafka::Connection
       */

      InstanceMethod("configureCallbacks", &Producer::NodeConfigureCallbacks),

	/*
	 * @brief Methods to do with establishing state
	 */

	InstanceMethod("connect", &Producer::NodeConnect),
	InstanceMethod("disconnect", &Producer::NodeDisconnect),
	InstanceMethod("getMetadata", &Producer::NodeGetMetadata),
	InstanceMethod("queryWatermarkOffsets", &Producer::NodeQueryWatermarkOffsets),  // NOLINT
	InstanceMethod("poll", &Producer::NodePoll),
	InstanceMethod("setPollInBackground", &Producer::NodeSetPollInBackground),
	InstanceMethod("setSaslCredentials", &Producer::NodeSetSaslCredentials),
	InstanceMethod("setOAuthBearerToken", &Producer::NodeSetOAuthBearerToken),
	StaticMethod("setOAuthBearerTokenFailure",&Producer::NodeSetOAuthBearerTokenFailure),

	/*
	 * @brief Methods exposed to do with message production
	 */

	InstanceMethod("setPartitioner", &Producer::NodeSetPartitioner),
	InstanceMethod("produce", &Producer::NodeProduce),

	InstanceMethod("flush", &Producer::NodeFlush),

	/*
	 * @brief Methods exposed to do with transactions
	 */

	InstanceMethod("initTransactions", &Producer::NodeInitTransactions),
	InstanceMethod("beginTransaction", &Producer::NodeBeginTransaction),
	InstanceMethod("commitTransaction", &Producer::NodeCommitTransaction),
	InstanceMethod("abortTransaction", &Producer::NodeAbortTransaction),
	InstanceMethod("sendOffsetsToTransaction", &Producer::NodeSendOffsetsToTransaction), // NOLINT
      });




    // connect. disconnect. resume. pause. get meta data
  constructor.Reset(Producer);

  exports.Set(Napi::String::New(env, "Producer"), Producer);
}


Baton Producer::Connect() {
  if (IsConnected()) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  std::string errstr;

  Baton baton = setupSaslOAuthBearerConfig();
  if (baton.err() != RdKafka::ERR_NO_ERROR) {
    return baton;
  }

  {
    scoped_shared_read_lock lock(m_connection_lock);
    m_client = RdKafka::Producer::create(m_gconfig, errstr);
  }

  if (!m_client) {
    return Baton(RdKafka::ERR__STATE, errstr);
  }

  /* Set the client name at the first possible opportunity for logging. */
  m_event_cb.dispatcher.SetClientName(m_client->name());

  baton = setupSaslOAuthBearerBackgroundQueue();
  return baton;
}

void Producer::ActivateDispatchers() {
  m_gconfig->listen();               // From global config.
  m_event_cb.dispatcher.Activate();  // From connection
  m_dr_cb.dispatcher.Activate();
}

void Producer::DeactivateDispatchers() {
  m_gconfig->stop();                   // From global config.
  m_event_cb.dispatcher.Deactivate();  // From connection
  m_dr_cb.dispatcher.Deactivate();
}

void Producer::Disconnect() {
  if (IsConnected()) {
    scoped_shared_write_lock lock(m_connection_lock);
    delete m_client;
    m_client = NULL;
  }
}

/**
 * [Producer::Produce description]
 * @param message - pointer to the message we are sending. This method will
 * create a copy of it, so you are still required to free it when done.
 * @param size - size of the message. We are copying the memory so we need
 * the size
 * @param topic - RdKafka::Topic* object to send the message to. Generally
 * created by NodeKafka::Topic::toRDKafkaTopic
 * @param partition - partition to send it to. Send in
 * RdKafka::Topic::PARTITION_UA to send to an unassigned topic
 * @param key - a string pointer for the key, or null if there is none.
 * @return - A baton object with error code set if it failed.
 */
Baton Producer::Produce(void* message, size_t size, RdKafka::Topic* topic,
  int32_t partition, const void *key, size_t key_len, void* opaque) {
  RdKafka::ErrorCode response_code;

  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      response_code = producer->produce(topic, partition,
	    RdKafka::Producer::RK_MSG_COPY,
	    message, size, key, key_len, opaque);
    } else {
      response_code = RdKafka::ERR__STATE;
    }
  } else {
    response_code = RdKafka::ERR__STATE;
  }

  // These topics actually link to the configuration
  // they are made from. It's so we can reuse topic configurations
  // That means if we delete it here and librd thinks its still linked,
  // producing to the same topic will try to reuse it and it will die.
  //
  // Honestly, we may need to make configuration a first class object
  // @todo(Conf needs to be a first class object that is passed around)
  // delete topic;

  if (response_code != RdKafka::ERR_NO_ERROR) {
    return Baton(response_code);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

/**
 * [Producer::Produce description]
 * @param message - pointer to the message we are sending. This method will
 * create a copy of it, so you are still required to free it when done.
 * @param size - size of the message. We are copying the memory so we need
 * the size
 * @param topic - String topic to use so we do not need to create
 * an RdKafka::Topic*
 * @param partition - partition to send it to. Send in
 * RdKafka::Topic::PARTITION_UA to send to an unassigned topic
 * @param key - a string pointer for the key, or null if there is none.
 * @return - A baton object with error code set if it failed.
 */
Baton Producer::Produce(void* message, size_t size, std::string topic,
  int32_t partition, std::string *key, int64_t timestamp, void* opaque,
  RdKafka::Headers* headers) {
  return Produce(message, size, topic, partition,
    key ? key->data() : NULL, key ? key->size() : 0,
    timestamp, opaque, headers);
}

/**
 * [Producer::Produce description]
 * @param message - pointer to the message we are sending. This method will
 * create a copy of it, so you are still required to free it when done.
 * @param size - size of the message. We are copying the memory so we need
 * the size
 * @param topic - String topic to use so we do not need to create
 * an RdKafka::Topic*
 * @param partition - partition to send it to. Send in
 * RdKafka::Topic::PARTITION_UA to send to an unassigned topic
 * @param key - a string pointer for the key, or null if there is none.
 * @return - A baton object with error code set if it failed.
 */
Baton Producer::Produce(void* message, size_t size, std::string topic,
  int32_t partition, const void *key, size_t key_len,
  int64_t timestamp, void* opaque, RdKafka::Headers* headers) {
  RdKafka::ErrorCode response_code;

  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      // This one is a bit different
      response_code = producer->produce(topic, partition,
	    RdKafka::Producer::RK_MSG_COPY,
	    message, size,
	    key, key_len,
	    timestamp, headers, opaque);
    } else {
      response_code = RdKafka::ERR__STATE;
    }
  } else {
    response_code = RdKafka::ERR__STATE;
  }

  // These topics actually link to the configuration
  // they are made from. It's so we can reuse topic configurations
  // That means if we delete it here and librd thinks its still linked,
  // producing to the same topic will try to reuse it and it will die.
  //
  // Honestly, we may need to make configuration a first class object
  // @todo(Conf needs to be a first class object that is passed around)
  // delete topic;

  if (response_code != RdKafka::ERR_NO_ERROR) {
    return Baton(response_code);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

void Producer::Poll() {
  // We're not allowed to call poll when we have forwarded the main
  // queue to the background queue, as that would indirectly poll
  // the background queue. However, that's not allowed by librdkafka.
  if (m_is_background_polling) {
    return;
  }
  m_client->poll(0);
}

Baton Producer::SetPollInBackground(bool set) {
  scoped_shared_read_lock lock(m_connection_lock);
  rd_kafka_t* rk = this->m_client->c_ptr();
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE, "Producer is disconnected");
  }

  if (set && !m_is_background_polling) {
    m_is_background_polling = true;
    rd_kafka_queue_t* main_q = rd_kafka_queue_get_main(rk);
    rd_kafka_queue_t* background_q = rd_kafka_queue_get_background(rk);
    rd_kafka_queue_forward(main_q, background_q);
    rd_kafka_queue_destroy(main_q);
    rd_kafka_queue_destroy(background_q);
  } else if (!set && m_is_background_polling) {
    m_is_background_polling = false;
    rd_kafka_queue_t* main_q = rd_kafka_queue_get_main(rk);
    rd_kafka_queue_forward(main_q, NULL);
    rd_kafka_queue_destroy(main_q);
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

// void Producer::ConfigureCallback(const std::string& string_key,
//                                  const Napi::Function& cb, bool add) {
//   if (string_key.compare("delivery_cb") == 0) {
//     if (add) {
//       bool dr_msg_cb = false;
//       Napi::String dr_msg_cb_key = Napi::String::New(env, "dr_msg_cb"); // NOLINT
//       if ((cb).Has(dr_msg_cb_key).FromMaybe(false)) {
//         Napi::Value v = (cb).Get(dr_msg_cb_key);
//         if (v->IsBoolean()) {
//           dr_msg_cb = v.As<Napi::Boolean>().Value().ToChecked();
//         }
//       }
//       if (dr_msg_cb) {
//         this->m_dr_cb.SendMessageBuffer(true);
//       }
//       this->m_dr_cb.dispatcher.AddCallback(cb);
//     } else {
//       this->m_dr_cb.dispatcher.RemoveCallback(cb);
//     }
//   } else {
//     Connection::ConfigureCallback(string_key, cb, add);
//   }
// }

Baton Producer::InitTransactions(int32_t timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->init_transactions(timeout_ms);

  return rdkafkaErrorToBaton( error);
}

Baton Producer::BeginTransaction() {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->begin_transaction();

  return rdkafkaErrorToBaton( error);
}

Baton Producer::CommitTransaction(int32_t timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->commit_transaction(timeout_ms);

  return rdkafkaErrorToBaton( error);
}

Baton Producer::AbortTransaction(int32_t timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error = producer->abort_transaction(timeout_ms);

  return rdkafkaErrorToBaton( error);
}

Baton Producer::SendOffsetsToTransaction(
  std::vector<RdKafka::TopicPartition*> &offsets,
  NodeKafka::KafkaConsumer* consumer,
  int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  RdKafka::ConsumerGroupMetadata* group_metadata =
      dynamic_cast<RdKafka::KafkaConsumer*>(consumer->m_client)->groupMetadata(); // NOLINT

  RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
  RdKafka::Error* error =
    producer->send_offsets_to_transaction(offsets, group_metadata, timeout_ms);
  delete group_metadata;

  return rdkafkaErrorToBaton( error);
}

/* Node exposed methods */

/**
 * @brief Producer::NodeProduce - produce a message through a producer
 *
 * This is a synchronous method. You may ask, "why?". The answer is because
 * there is no true value doing this asynchronously. All it does is degrade
 * performance. This method does not block - all it does is add a message
 * to a queue. In the case where the queue is full, it will return an error
 * immediately. The only way this method blocks is when you provide it a
 * flag to do so, which we never do.
 *
 * Doing it asynchronously eats up the libuv threadpool for no reason and
 * increases execution time by a very small amount. It will take two ticks of
 * the event loop to execute at minimum - 1 for executing it and another for
 * calling back the callback.
 *
 * @sa RdKafka::Producer::produce
 */
Napi::Value Producer::NodeProduce(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  // Need to extract the message data here.
  if (info.Length() < 3) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a topic, partition, and message").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Second parameter is the partition
  int32_t partition;

  if (info[1].IsNull() || info[1].IsUndefined()) {
    partition = RdKafka::Topic::PARTITION_UA;
  } else {
    partition = info[1].As<Napi::Number>().Int32Value();
  }

  if (partition < 0) {
    partition = RdKafka::Topic::PARTITION_UA;
  }

  size_t message_buffer_length;
  void* message_buffer_data;

  if (info[2].IsNull()) {
    // This is okay for whatever reason
    message_buffer_length = 0;
    message_buffer_data = NULL;
  } else if (!info[2].IsBuffer()) {
    Napi::Error::New(env, "Message must be a buffer or null").ThrowAsJavaScriptException();
    return env.Null();
  } else {
    Napi::Object message_buffer_object = info[2].ToObject();

    // v8 handles the garbage collection here so we need to make a copy of
    // the buffer or assign the buffer to a persistent handle.

    // I'm not sure which would be the more performant option. I assume
    // the persistent handle would be but for now we'll try this one
    // which should be more memory-efficient and allow v8 to dispose of the
    // buffer sooner

    message_buffer_length = message_buffer_object.As<Napi::Buffer<char>>().Length();
    message_buffer_data = message_buffer_object.As<Napi::Buffer<char>>().Data();
    if (message_buffer_data == NULL) {
      // empty string message buffer should not end up as null message
      Napi::Object message_buffer_object_emptystring =
	  Napi::Buffer<char>::New(env, new char[0], 0);
      message_buffer_length =
	  message_buffer_object_emptystring.As<Napi::Buffer<char>>().Length();
      message_buffer_data = message_buffer_object_emptystring.As<Napi::Buffer<char>>().Data(); // NOLINT
    }
  }

  size_t key_buffer_length;
  const void* key_buffer_data;
  std::string * key = NULL;

  if (info[3].IsNull() || info[3].IsUndefined()) {
    // This is okay for whatever reason
    key_buffer_length = 0;
    key_buffer_data = NULL;
  } else if (info[3].IsBuffer()) {
    Napi::Object key_buffer_object = info[3].ToObject();

    // v8 handles the garbage collection here so we need to make a copy of
    // the buffer or assign the buffer to a persistent handle.

    // I'm not sure which would be the more performant option. I assume
    // the persistent handle would be but for now we'll try this one
    // which should be more memory-efficient and allow v8 to dispose of the
    // buffer sooner

    key_buffer_length = key_buffer_object.As<Napi::Buffer<char>>().Length();
    key_buffer_data = key_buffer_object.As<Napi::Buffer<char>>().Data();
    if (key_buffer_data == NULL) {
      // empty string key buffer should not end up as null key
      Napi::Object key_buffer_object_emptystring =
	  Napi::Buffer<char>::New(env, new char[0], 0);
      key_buffer_length = key_buffer_object_emptystring.As<Napi::Buffer<char>>().Length();
      key_buffer_data = key_buffer_object_emptystring.As<Napi::Buffer<char>>().Data();
    }
  } else {
    // If it was a string just use the utf8 value.
    Napi::String val = info[3].ToString();
    // Get string pointer for this thing
    std::string keyUTF8 = val.Utf8Value();
    key = new std::string(keyUTF8);

    key_buffer_data = key->data();
    key_buffer_length = key->length();
  }

  int64_t timestamp;

  if (info.Length() > 4 && !info[4].IsUndefined() && !info[4].IsNull()) {
    if (!info[4].IsNumber()) {
      Napi::Error::New(env, "Timestamp must be a number").ThrowAsJavaScriptException();
      return env.Null();
    }

    timestamp = info[4].As<Napi::Number>().Int64Value();
  } else {
    timestamp = 0;
  }

  void* opaque = NULL;
  // Opaque handling
  if (info.Length() > 5 && !info[5].IsUndefined()) {
    // We need to create a persistent handle
    opaque = Napi::Persistent(info[5]);
    // To get the local from this later,
    // Napi::Object object = Napi::New(env, persistent);
  }

  std::vector<RdKafka::Headers::Header> headers;
  if (info.Length() > 6 && !info[6].IsUndefined()) {
    Napi::Array v8Headers = info[6].As<Napi::Array>();

    if (v8Headers.Length() >= 1) {
      for (unsigned int i = 0; i < v8Headers.Length(); i++) {
	Napi::Object header = (v8Headers).Get(i)
	  .ToObject();
	if (header.IsEmpty()) {
	  continue;
	}

	Napi::Array props = header.GetPropertyNames();

	// TODO: Other properties in the list of properties should not be
	// ignored, but they are. This is a bug, need to handle it either in JS
	// or here.
	Napi::MaybeOrValue<Napi::Value> jsKey = props.Get(Napi::Value::From(env, 0));

	// The key must be a string.
	if (jsKey.IsEmpty()) {
	  Napi::Error::New(env, "Header key must be a string").ThrowAsJavaScriptException();

	}
	std::string uKey = jsKey.ToString().Utf8Value();
	std::string key(uKey);

	// Valid types for the header are string or buffer.
	// Other types will throw an error.
	Napi::Value v8Value =
	    (header).Get(jsKey);

	if (v8Value.IsBuffer()) {
	  const char* value = v8Value.As<Napi::Buffer<char>>().Data();
	  const size_t value_len = v8Value.As<Napi::Buffer<char>>().Length();
	  headers.push_back(RdKafka::Headers::Header(key, value, value_len));
	} else if (v8Value.IsString()) {
	  std::string uValue = v8Value.As<Napi::String>().Utf8Value();
	  std::string value(uValue);
	  headers.push_back(
	      RdKafka::Headers::Header(key, value.c_str(), value.size()));
	} else {
	  Napi::Error::New(env, "Header value must be a string or buffer").ThrowAsJavaScriptException();

	}
      }
    }
  }


  // Let the JS library throw if we need to so the error can be more rich
  int error_code;

  if (info[0].IsString()) {
    // Get string pointer for this thing
    std::string topicUTF8 = info[0].ToString().Utf8Value();
    std::string topic_name(topicUTF8);
    RdKafka::Headers *rd_headers = RdKafka::Headers::create(headers);

    Baton b = this->Produce(message_buffer_data, message_buffer_length,
     topic_name, partition, key_buffer_data, key_buffer_length,
     timestamp, opaque, rd_headers);

    error_code = static_cast<int>(b.err());
    if (error_code != 0 && rd_headers) {
      delete rd_headers;
    }
  } else {
    // First parameter is a topic OBJECT
    Topic* topic = ObjectWrap<Topic>::Unwrap(info[0].As<Napi::Object>());

    // Unwrap it and turn it into an RdKafka::Topic*
    Baton topic_baton = topic->toRDKafkaTopic(this);

    if (topic_baton.err() != RdKafka::ERR_NO_ERROR) {
      // Let the JS library throw if we need to so the error can be more rich
      error_code = static_cast<int>(topic_baton.err());

      return Napi::Number::New(env, error_code);
    }

    RdKafka::Topic* rd_topic = topic_baton.data<RdKafka::Topic*>();

    Baton b = this->Produce(message_buffer_data, message_buffer_length,
     rd_topic, partition, key_buffer_data, key_buffer_length, opaque);

    // Delete the topic when we are done.
    delete rd_topic;

    error_code = static_cast<int>(b.err());
  }

  if (error_code != 0 && opaque) {
    // If there was an error enqueing this message, there will never
    // be a delivery report for it, so we have to clean up the opaque
    // data now, if there was any.

    Napi::Reference<Napi::Value> *persistent =
      static_cast<Napi::Reference<Napi::Value> *>(opaque);
    persistent->Reset();
    delete persistent;
  }

  if (key != NULL) {
    delete key;
  }

  return Napi::Number::New(env, error_code);
}

Napi::Value Producer::NodeSetPartitioner(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Function cb = info[0].As<Napi::Function>();
  this->m_partitioner_cb.SetCallback(cb);
  return Napi::Value::From(env, true);
}

Napi::Value Producer::NodeConnect(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  // This needs to be offloaded to libuv
  Napi::Function cb = info[0].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  // Activate the dispatchers before the connection, as some callbacks may run
  // on the background thread.
  // We will deactivate them if the connection fails.
  this->ActivateDispatchers();

  (new Workers::ProducerConnect(callback, this))->Queue();

  return env.Null();
}

Napi::Value Producer::NodePoll(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (!this->IsConnected()) {
    Napi::Error::New(env, "Producer is disconnected").ThrowAsJavaScriptException();
    return env.Null();
  } else {
    this->Poll();
    return Napi::Boolean::From(env, true);
  }
}

Napi::Value Producer::NodeSetPollInBackground(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);
  if (info.Length() < 1 || !info[0].IsBoolean()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a boolean for setting or unsetting")
      .ThrowAsJavaScriptException();
  }
  bool set = info[0].As<Napi::Boolean>().Value();

  Baton b = this->SetPollInBackground(set);
  if (b.err() != RdKafka::ERR_NO_ERROR) {
    Napi::Error::New(env, b.errstr().c_str()).ThrowAsJavaScriptException();
    return env.Null();
  }
  return b.ToError(env).Value();
}

Baton Producer::Flush(int timeout_ms) {
  RdKafka::ErrorCode response_code;
  if (IsConnected()) {
    scoped_shared_read_lock lock(m_connection_lock);
    if (IsConnected()) {
      RdKafka::Producer* producer = dynamic_cast<RdKafka::Producer*>(m_client);
      response_code = producer->flush(timeout_ms);
    } else {
      response_code = RdKafka::ERR__STATE;
    }
  } else {
    response_code = RdKafka::ERR__STATE;
  }

  return Baton(response_code);
}

Napi::Value Producer::NodeFlush(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[1].IsFunction() || !info[0].IsNumber()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a timeout and a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms = info[0].As<Napi::Number>().Int32Value();

  Napi::Function cb = info[1].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Napi::AsyncWorker* worker = new Workers::ProducerFlush(callback, this, timeout_ms);
  worker->Queue();

  return env.Null();
}

Napi::Value Producer::NodeDisconnect(const Napi::CallbackInfo &info) {
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


  Napi::AsyncWorker* worker = new Workers::ProducerDisconnect(callback, this);
  worker->Queue();

  return env.Null();
}

Napi::Value Producer::NodeInitTransactions(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[1].IsFunction() || !info[0].IsNumber()) {
    Napi::Error::New(env, "Need to specify a timeout and a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms = info[0].As<Napi::Number>().Int32Value();

  Napi::Function cb = info[1].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Napi::AsyncWorker* worker = new Workers::ProducerInitTransactions(callback, this, timeout_ms);
  worker->Queue();

  return env.Null();
}

Napi::Value Producer::NodeBeginTransaction(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Function cb = info[0].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Napi::AsyncWorker* worker = new Workers::ProducerBeginTransaction(callback, this);
  worker->Queue();

  return env.Null();
}

Napi::Value Producer::NodeCommitTransaction(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[1].IsFunction() || !info[0].IsNumber()) {
    Napi::Error::New(env, "Need to specify a timeout and a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms = info[0].As<Napi::Number>().Int32Value();

  Napi::Function cb = info[1].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Napi::AsyncWorker* worker = new Workers::ProducerCommitTransaction(callback, this, timeout_ms);
  worker->Queue();

  return env.Null();
}

Napi::Value Producer::NodeAbortTransaction(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[1].IsFunction() || !info[0].IsNumber()) {
    Napi::Error::New(env, "Need to specify a timeout and a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  int timeout_ms = info[0].As<Napi::Number>().Int32Value();

  Napi::Function cb = info[1].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Napi::AsyncWorker *worker =
      new Workers::ProducerAbortTransaction(callback, this, timeout_ms);
  worker->Queue();

  return env.Null();
}

Napi::Value
Producer::NodeSendOffsetsToTransaction(const Napi::CallbackInfo &info) {
    const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 4) {
    return ThrowError(env,
      "Need to specify offsets, consumer, timeout for 'send offsets to transaction', and callback"); // NOLINT
  }
  if (!info[0].IsArray()) {
    return ThrowError(env,
      "First argument to 'send offsets to transaction' has to be a consumer object"); // NOLINT
  }
  if (!info[1].IsObject()) {
    return ThrowError(env, "Kafka consumer must be provided");

  }
  if (!info[2].IsNumber()) {
    return ThrowError(env, "Timeout must be provided");

  }
  if (!info[3].IsFunction()) {
    return ThrowError(env, "Need to specify a callback");
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<Napi::Array>());

  NodeKafka::KafkaConsumer *consumer =
    ObjectWrap<KafkaConsumer>::Unwrap(info[1].As<Napi::Object>());

  int timeout_ms = info[2].As<Napi::Number>().Int32Value();
  Napi::Function cb = info[3].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  Producer *producer = this;

  Napi::AsyncWorker *worker = new Workers::ProducerSendOffsetsToTransaction(
      callback, producer, toppars, consumer, timeout_ms);
  worker->Queue();

  return env.Null();
}

}  // namespace NodeKafka
