/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_CONNECTION_H_
#define SRC_CONNECTION_H_

#include <napi.h>
#include <uv.h>
#include <iostream>
#include <list>
#include <string>
#include <vector>

#include "rdkafkacpp.h" // NOLINT

#include "src/common.h"
#include "src/errors.h"
#include "src/config.h"
#include "src/callbacks.h"

namespace NodeKafka {

/**
 * @brief Connection v8 wrapped object.
 *
 * Wraps the RdKafka::Handle object with compositional inheritence and
 * provides sensible defaults for exposing callbacks to node
 *
 * This object can't itself expose methods to the prototype directly, as far
 * as I can tell. But it can provide the NAN_METHODS that just need to be added
 * to the prototype. Since connections, etc. are managed differently based on
 * whether it is a producer or consumer, they manage that. This base class
 * handles some of the wrapping functionality and more importantly, the
 * configuration of callbacks
 *
 * Any callback available to both consumers and producers, like logging or
 * events will be handled in here.
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

template <class T> class Connection : public Napi::ObjectWrap<T> {
 public:
  bool IsConnected() const {
    return !m_is_closing && m_client != NULL;
  }

  bool IsClosing() const {
    return m_client != NULL && m_is_closing;
  }
  
  // Baton<RdKafka::Topic*>
  Baton CreateTopic(std::string topic_name, RdKafka::Conf* conf = NULL) {
    std::string errstr;

    RdKafka::Topic* topic = NULL;

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	topic = RdKafka::Topic::create(m_client, topic_name, conf, errstr);
      } else {
	return Baton(RdKafka::ErrorCode::ERR__STATE);
      }
    } else {
      return Baton(RdKafka::ErrorCode::ERR__STATE);
    }

    if (!errstr.empty()) {
      return Baton(RdKafka::ErrorCode::ERR_TOPIC_EXCEPTION, errstr);
    }

    // Maybe do it this way later? Then we don't need to do static_cast
    // <RdKafka::Topic*>
    return Baton(topic);
  }

  Baton GetMetadata(bool all_topics, std::string topic_name, int timeout_ms) {
    RdKafka::Topic* topic = NULL;
    RdKafka::ErrorCode err;

    std::string errstr;

    if (!topic_name.empty()) {
      Baton b = CreateTopic(topic_name);
      if (b.err() == RdKafka::ErrorCode::ERR_NO_ERROR) {
	topic = b.data<RdKafka::Topic*>();
      }
    }

    RdKafka::Metadata* metadata = NULL;

    if (!errstr.empty()) {
      return Baton(RdKafka::ERR_TOPIC_EXCEPTION);
    }

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	// Always send true - we
	err = m_client->metadata(all_topics, topic, &metadata, timeout_ms);
      } else {
	err = RdKafka::ERR__STATE;
      }
    } else {
      err = RdKafka::ERR__STATE;
    }

    if (topic != NULL)
      delete topic;

    if (err == RdKafka::ERR_NO_ERROR) {
      return Baton(metadata);
    } else {
      // metadata is not set here
      // @see https://github.com/confluentinc/librdkafka/blob/master/src-cpp/rdkafkacpp.h#L860 // NOLINT
      return Baton(err);
    }
  }

  Baton QueryWatermarkOffsets(
			      std::string topic_name, int32_t partition,
			      int64_t* low_offset, int64_t* high_offset,
			      int timeout_ms) {
    // Check if we are connected first

    RdKafka::ErrorCode err;

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	// Always send true - we
	err = m_client->query_watermark_offsets(topic_name, partition,
						low_offset, high_offset, timeout_ms);

      } else {
	err = RdKafka::ERR__STATE;
      }
    } else {
      err = RdKafka::ERR__STATE;
    }

    return Baton(err);
  }

  /**
   * Look up the offsets for the given partitions by timestamp.
   *
   * The returned offset for each partition is the earliest offset whose
   * timestamp is greater than or equal to the given timestamp in the
   * corresponding partition.
   *
   * @returns A baton specifying the error state. If there was no error,
   *          there still may be an error on a topic partition basis.
   */
  Baton OffsetsForTimes(
			std::vector<RdKafka::TopicPartition*> &toppars,
			int timeout_ms) {
    // Check if we are connected first

    RdKafka::ErrorCode err;

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	// Always send true - we
	err = m_client->offsetsForTimes(toppars, timeout_ms);

      } else {
	err = RdKafka::ERR__STATE;
      }
    } else {
      err = RdKafka::ERR__STATE;
    }

    return Baton(err);
  }

  Baton SetSaslCredentials(
			   std::string username, std::string password) {
    RdKafka::Error *error;

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	// Always send true - we
	error = m_client->sasl_set_credentials(username, password);
      } else {
	return Baton(RdKafka::ERR__STATE);
      }
    } else {
      return Baton(RdKafka::ERR__STATE);
    }

    return rdkafkaErrorToBaton(error);
  }

  Baton SetOAuthBearerToken(
			    const std::string& value, int64_t lifetime_ms,
			    const std::string& principal_name,
			    const std::list<std::string>& extensions) {
    RdKafka::ErrorCode error_code;
    std::string errstr;

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	error_code = m_client->oauthbearer_set_token(
						     value, lifetime_ms, principal_name, extensions, errstr);
      } else {
	return Baton(RdKafka::ERR__STATE);
      }
    } else {
      return Baton(RdKafka::ERR__STATE);
    }

    if (error_code != RdKafka::ERR_NO_ERROR) {
      return Baton(error_code, errstr);
    }

    return Baton(error_code);
  }

  Baton SetOAuthBearerTokenFailure(const std::string& errstr) {
    RdKafka::ErrorCode error_code;

    if (IsConnected()) {
      scoped_shared_read_lock lock(m_connection_lock);
      if (IsConnected()) {
	error_code = m_client->oauthbearer_set_token_failure(errstr);
      } else {
	return Baton(RdKafka::ERR__STATE);
      }
    } else {
      return Baton(RdKafka::ERR__STATE);
    }

    return Baton(error_code);
  }

  RdKafka::Handle* GetClient() {
    return m_client;
  }

  static RdKafka::TopicPartition* GetPartition(std::string &topic) {
    return RdKafka::TopicPartition::create(topic, RdKafka::Topic::PARTITION_UA);
  }

  static RdKafka::TopicPartition* GetPartition(std::string &topic, int partition) {  // NOLINT
    return RdKafka::TopicPartition::create(topic, partition);
  }

  Callbacks::Event m_event_cb;

  virtual void ActivateDispatchers() = 0;
  virtual void DeactivateDispatchers() = 0;

  virtual void ConfigureCallback(
				 const std::string &string_key, const Napi::Function &cb, bool add) {
    if (string_key.compare("event_cb") == 0) {
      if (add) {
	this->m_event_cb.dispatcher.AddCallback(cb);
      } else {
	this->m_event_cb.dispatcher.RemoveCallback(cb);
      }
    }
  }

  std::string Name() const {
    if (!IsConnected()) {
      return std::string("");
    }
    return std::string(m_client->name());
  }


protected:
  Connection(const Napi::CallbackInfo &info): m_event_cb() {
    Napi::Env env = info.Env(); 
    if (!info.IsConstructCall()) {
      Napi::Error::New(env, "non-constructor invocation not supported").ThrowAsJavaScriptException();
    }

    if (info.Length() < 2) {
      Napi::Error::New(env, "You must supply global and topic configuration").ThrowAsJavaScriptException();

    }
  }

  void Config(Conf *gconfig, Conf *tconfig) {
    this->m_gconfig = gconfig;
    this->m_tconfig = tconfig;
    
    std::string errstr;

    m_client = NULL;
    m_is_closing = false;
    uv_rwlock_init(&m_connection_lock);

    // Try to set the event cb. Shouldn't be an error here, but if there
    // is, it doesn't get reported.
    //
    // Perhaps node new methods should report this as an error? But there
    // isn't anything the user can do about it.
    m_gconfig->set("event_cb", &m_event_cb, errstr);
  }
  explicit Connection(Connection *existing):
    m_event_cb() {
    m_client = existing->m_client;

    m_gconfig = existing->m_gconfig;
    m_tconfig = existing->m_tconfig;

    m_is_closing = false;
    m_has_underlying = true;

    // We must share the same connection lock as the existing connection to
    // avoid getting disconnected while the existing connection is still in use.
    m_connection_lock = existing->m_connection_lock;
  }
  virtual ~Connection() {
    // The underlying connection will take care of cleanup.
    if (m_has_underlying) {
      return;
    }

    uv_rwlock_destroy(&m_connection_lock);
    if (m_tconfig) {
      delete m_tconfig;
    }

    if (m_gconfig) {
      delete m_gconfig;
    }
  }

  static Napi::FunctionReference constructor;

  static Baton rdkafkaErrorToBaton(RdKafka::Error* error) {
    if (NULL == error) {
      return Baton(RdKafka::ERR_NO_ERROR);
    } else {
      Baton result(error->code(), error->str(), error->is_fatal(),
		   error->is_retriable(), error->txn_requires_abort());
      delete error;
      return result;
    }
  }

  // If OAUTHBEARER authentication is set up, then push the callbacks onto the
  // SASL queue so we don't need to keep polling. This method should be called
  // before the client is created.
  Baton setupSaslOAuthBearerConfig() {
    if (!m_gconfig->is_sasl_oauthbearer()) {
      return Baton(RdKafka::ERR_NO_ERROR);
    }

    std::string errstr;
    if (m_gconfig->enable_sasl_queue(true, errstr) != RdKafka::Conf::CONF_OK) {
      return Baton(RdKafka::ERR__STATE, errstr);
    }

    return Baton(RdKafka::ERR_NO_ERROR);
  }

  // If OAUTHBEARER authentication is set up, then handle the callbacks on
  // the background thread. This method should be called after the client is
  // created and only if `setupSaslOAuthBearerConfig` is called earlier.
  Baton setupSaslOAuthBearerBackgroundQueue() {
    if (!m_gconfig->is_sasl_oauthbearer()) {
      return Baton(RdKafka::ERR_NO_ERROR);
    }

    RdKafka::Error* error = m_client->sasl_background_callbacks_enable();
    return rdkafkaErrorToBaton(error);
  }
  
  // Baton setupSaslOAuthBearerConfig();
  // Baton setupSaslOAuthBearerBackgroundQueue();

  bool m_is_closing;

  Conf* m_gconfig;
  Conf* m_tconfig;
  std::string m_errstr;

  uv_rwlock_t m_connection_lock;
  bool m_has_underlying = false;

  RdKafka::Handle *m_client;

  // NAPI Methods


  Napi::Value NodeGetMetadata(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    Napi::HandleScope scope(env);

    Connection* obj = this;

    Napi::Object config;
    if (info[0].IsObject()) {
      config = info[0].As<Napi::Object>();
    } else {
      config = Napi::Object::New(env);
    }

    if (!info[1].IsFunction()) {
      Napi::Error::New(env, "Second parameter must be a callback").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Function cb = info[1].As<Napi::Function>();

    std::string topic = GetParameter<std::string>(config, "topic", "");
    bool allTopics = GetParameter<bool>(config, "allTopics", true);
    int timeout_ms = GetParameter<int64_t>(config, "timeout", 30000);

    Napi::FunctionReference* callback = new Napi::FunctionReference();
    *callback = Napi::Persistent(cb);

    Napi::AsyncWorker::Queue(new Workers::ConnectionMetadata(
							   callback, obj, topic, timeout_ms, allTopics));

    return env.Null();
  }

  Napi::Value NodeOffsetsForTimes(const Napi::CallbackInfo &info) {
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
    Napi::Maybe<uint32_t> maybeTimeout =
      info[1].As<Napi::Number>(.As<Napi::Number>().Uint32Value());

    if (maybeTimeout.IsNothing()) {
      timeout_ms = 1000;
    } else {
      timeout_ms = static_cast<int>(maybeTimeout);
    }

    Napi::Function cb = info[2].As<Napi::Function>();
    Napi::FunctionReference callback = Napi::Persistent(cb);

    Connection* handle = this;

    Napi::AsyncQueueWorker(
			   new Workers::Handle::OffsetsForTimes(callback, handle,
								toppars, timeout_ms));

    return env.Null();
  }

  Napi::Value NodeQueryWatermarkOffsets(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    Napi::HandleScope scope(env);

    Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

    if (!info[0].IsString()) {
      Napi::Error::New(env, "1st parameter must be a topic string").ThrowAsJavaScriptException();
      ;
      return;
    }

    if (!info[1].IsNumber()) {
      Napi::Error::New(env, "2nd parameter must be a partition number").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[2].IsNumber()) {
      Napi::Error::New(env, "3rd parameter must be a number of milliseconds").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[3].IsFunction()) {
      Napi::Error::New(env, "4th parameter must be a callback").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Get string pointer for the topic name
    std::string topicUTF8 = info[0].As<Napi::String>(.To<Napi::String>());
    // The first parameter is the topic
    std::string topic_name(*topicUTF8);

    // Second parameter is the partition
    int32_t partition = info[1].As<Napi::Number>().Int32Value();

    // Third parameter is the timeout
    int timeout_ms = info[2].As<Napi::Number>().Int32Value();

    // Fourth parameter is the callback
    Napi::Function cb = info[3].As<Napi::Function>();
    Napi::FunctionReference *callback = new Napi::FunctionReference(cb);

    Napi::AsyncQueueWorker(new Workers::ConnectionQueryWatermarkOffsets(
									callback, obj, topic_name, partition, timeout_ms));

    return env.Null();
  }

  Napi::Value NodeSetSaslCredentials(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!info[0].IsString()) {
      Napi::Error::New(env, "1st parameter must be a username string").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[1].IsString()) {
      Napi::Error::New(env, "2nd parameter must be a password string").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Get string pointer for the username
    std::string usernameUTF8 = info[0].As<Napi::String>(.To<Napi::String>());
    // The first parameter is the username
    std::string username(*usernameUTF8);

    // Get string pointer for the password
    std::string passwordUTF8 = info[1].As<Napi::String>(.To<Napi::String>());
    // The first parameter is the password
    std::string password(*passwordUTF8);

    Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
    Baton b = obj->SetSaslCredentials(username, password);

    if (b.err() != RdKafka::ERR_NO_ERROR) {
      Napi::Value errorObject = b.ToObject();
      Napi::Error::New(env, errorObject).ThrowAsJavaScriptException();
      return env.Null();
    }

    return env.Null();
  }


  // Node methods
  Napi::Value NodeConfigureCallbacks(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    Napi::HandleScope scope(env);

    if (info.Length() < 2 ||
	!info[0].IsBoolean() ||
	!info[1].IsObject()) {
      // Just throw an exception
      Napi::Error::New(env, "Need to specify a callbacks object").ThrowAsJavaScriptException();
      return env.Null();
    }
    v8::Local<v8::Context> context = Napi::GetCurrentContext();
    Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

    const bool add = info[0].As<Napi::Boolean>().Value().ToChecked();
    Napi::Object configs_object =
      info[1].ToObject(context);
    Napi::Array configs_property_names =
      configs_object->GetOwnPropertyNames(context);

    for (unsigned int j = 0; j < configs_property_names->Length(); ++j) {
      std::string configs_string_key;

      Napi::Value configs_key =
	(configs_property_names).Get(j);
      Napi::Value configs_value =
	(configs_object).Get(configs_key);

      int config_type = 0;
      if (configs_value.IsObject() && configs_key.IsString()) {
	std::string configs_utf8_key = configs_key.As<Napi::String>();
	configs_string_key = std::string(*configs_utf8_key);
	if (configs_string_key.compare("global") == 0) {
          config_type = 1;
	} else if (configs_string_key.compare("topic") == 0) {
          config_type = 2;
	} else if (configs_string_key.compare("event") == 0) {
          config_type = 3;
	} else {
	  continue;
	}
      } else {
	continue;
      }

      Napi::Object object =
	configs_value->ToObject(context);
      Napi::Array property_names =
	object->GetOwnPropertyNames(context);

      for (unsigned int i = 0; i < property_names->Length(); ++i) {
	std::string errstr;
	std::string string_key;

	Napi::Value key = (property_names).Get(i);
	Napi::Value value = (object).Get(key);

	if (key.IsString()) {
	  std::string utf8_key = key.As<Napi::String>();
	  string_key = std::string(*utf8_key);
	} else {
	  continue;
	}

	if (value->IsFunction()) {
	  Napi::Function cb = value.As<Napi::Function>();
	  switch (config_type) {
          case 1:
            obj->m_gconfig->ConfigureCallback(string_key, cb, add, errstr);
            if (!errstr.empty()) {
              Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
              return env.Null();
            }
            break;
          case 2:
            obj->m_tconfig->ConfigureCallback(string_key, cb, add, errstr);
            if (!errstr.empty()) {
              Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
              return env.Null();
            }
            break;
          case 3:
            obj->ConfigureCallback(string_key, cb, add);
            break;
	  }
	}
      }
    }

    return env.True();
  }

  Napi::Value NodeSetOAuthBearerToken(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!info[0].IsString()) {
      Napi::Error::New(env, "1st parameter must be a token string").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[1].IsNumber()) {
      Napi::Error::New(env, "2nd parameter must be a lifetime_ms number").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[2].IsString()) {
      Napi::Error::New(env, "3rd parameter must be a principal_name string").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (!info[3].IsNullOrUndefined() && !info[3].IsArray()) {
      Napi::Error::New(env, "4th parameter must be an extensions array or null").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Get string pointer for the token
    std::string tokenUtf8 = info[0].As<Napi::String>(.To<Napi::String>());
    std::string token(*tokenUtf8);

    // Get the lifetime_ms
    int64_t lifetime_ms = info[1].As<Napi::Number>().Int64Value();

    // Get string pointer for the principal_name
    std::string principal_nameUtf8 = 
      info[2].As<Napi::String>(.To<Napi::String>());
    std::string principal_name(*principal_nameUtf8);

    // Get the extensions (if any)
    std::list<std::string> extensions;
    if (!info[3].IsNullOrUndefined()) {
      Napi::Array extensionsArray = info[3].As<Napi::Array>();
      extensions = v8ArrayToStringList(extensionsArray);
    }

    Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
    Baton b =
      obj->SetOAuthBearerToken(token, lifetime_ms, principal_name, extensions);

    if (b.err() != RdKafka::ERR_NO_ERROR) {
      Napi::Value errorObject = b.ToObject();
      Napi::Error::New(env, errorObject).ThrowAsJavaScriptException();
      return env.Null();
    }

    return env.Null();
  }

  static Napi::Value NodeSetOAuthBearerTokenFailure(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (!info[0].IsString()) {
      Napi::Error::New(env, "1st parameter must be an error string").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Get string pointer for the error string
    std::string errstrUtf8 = info[0].As<Napi::String>(.To<Napi::String>());
    std::string errstr(*errstrUtf8);

    Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
    Baton b = obj->SetOAuthBearerTokenFailure(errstr);

    if (b.err() != RdKafka::ERR_NO_ERROR) {
      Napi::Value errorObject = b.ToObject();
      Napi::Error::New(env, errorObject).ThrowAsJavaScriptException();
      return env.Null();
    }

    return env.Null();
  }

  Napi::Value NodeName(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
    std::string name = obj->Name();
    return Napi::New(env, name);
  }
  
};

}  // namespace NodeKafka

#endif  // SRC_CONNECTION_H_
