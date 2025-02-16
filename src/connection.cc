/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
#include "src/connection.h"

#include <list>
#include <string>
#include <vector>

#include "src/workers.h"

using RdKafka::Conf;

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

Connection::Connection(Conf* gconfig, Conf* tconfig):
  m_event_cb(),
  m_gconfig(gconfig),
  m_tconfig(tconfig) {
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

/* Use an existing Connection object as the underlying for this object.
 * At this point, the underlying connection is assumed to be connected with
 * the m_client set. */
Connection::Connection(Connection *existing):
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


Connection::~Connection() {
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

Baton Connection::rdkafkaErrorToBaton(RdKafka::Error* error) {
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
Baton Connection::setupSaslOAuthBearerConfig() {
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
Baton Connection::setupSaslOAuthBearerBackgroundQueue() {
  if (!m_gconfig->is_sasl_oauthbearer()) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  RdKafka::Error* error = m_client->sasl_background_callbacks_enable();
  return rdkafkaErrorToBaton(error);
}

RdKafka::TopicPartition* Connection::GetPartition(std::string &topic) {
  return RdKafka::TopicPartition::create(topic, RdKafka::Topic::PARTITION_UA);
}

RdKafka::TopicPartition* Connection::GetPartition(std::string &topic, int partition) {  // NOLINT
  return RdKafka::TopicPartition::create(topic, partition);
}

bool Connection::IsConnected() const {
  return !m_is_closing && m_client != NULL;
}

bool Connection::IsClosing() const {
  return m_client != NULL && m_is_closing;
}

RdKafka::Handle* Connection::GetClient() {
  return m_client;
}

std::string Connection::Name() const {
  if (!IsConnected()) {
    return std::string("");
  }
  return std::string(m_client->name());
}

Baton Connection::CreateTopic(std::string topic_name) {
  return CreateTopic(topic_name, NULL);
}

Baton Connection::CreateTopic(std::string topic_name, RdKafka::Conf* conf) {
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

Baton Connection::QueryWatermarkOffsets(
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
Baton Connection::OffsetsForTimes(
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

Baton Connection::GetMetadata(
  bool all_topics, std::string topic_name, int timeout_ms) {
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

Baton Connection::SetSaslCredentials(
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

Baton Connection::SetOAuthBearerToken(
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

Baton Connection::SetOAuthBearerTokenFailure(const std::string& errstr) {
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

void Connection::ConfigureCallback(
  const std::string &string_key, const v8::Local<v8::Function> &cb, bool add) {
  if (string_key.compare("event_cb") == 0) {
    if (add) {
      this->m_event_cb.dispatcher.AddCallback(cb);
    } else {
      this->m_event_cb.dispatcher.RemoveCallback(cb);
    }
  }
}

// NAN METHODS

NAN_METHOD(Connection::NodeGetMetadata) {
  Nan::HandleScope scope;

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

  v8::Local<v8::Object> config;
  if (info[0]->IsObject()) {
    config = info[0].As<v8::Object>();
  } else {
    config = Nan::New<v8::Object>();
  }

  if (!info[1]->IsFunction()) {
    Nan::ThrowError("Second parameter must be a callback");
    return;
  }

  v8::Local<v8::Function> cb = info[1].As<v8::Function>();

  std::string topic = GetParameter<std::string>(config, "topic", "");
  bool allTopics = GetParameter<bool>(config, "allTopics", true);
  int timeout_ms = GetParameter<int64_t>(config, "timeout", 30000);

  Nan::Callback *callback = new Nan::Callback(cb);

  Nan::AsyncQueueWorker(new Workers::ConnectionMetadata(
    callback, obj, topic, timeout_ms, allTopics));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Connection::NodeOffsetsForTimes) {
  Nan::HandleScope scope;

  if (info.Length() < 3 || !info[0]->IsArray()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify an array of topic partitions");
  }

  std::vector<RdKafka::TopicPartition *> toppars =
    Conversion::TopicPartition::FromV8Array(info[0].As<v8::Array>());

  int timeout_ms;
  Nan::Maybe<uint32_t> maybeTimeout =
    Nan::To<uint32_t>(info[1].As<v8::Number>());

  if (maybeTimeout.IsNothing()) {
    timeout_ms = 1000;
  } else {
    timeout_ms = static_cast<int>(maybeTimeout.FromJust());
  }

  v8::Local<v8::Function> cb = info[2].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Connection* handle = ObjectWrap::Unwrap<Connection>(info.This());

  Nan::AsyncQueueWorker(
    new Workers::Handle::OffsetsForTimes(callback, handle,
      toppars, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Connection::NodeQueryWatermarkOffsets) {
  Nan::HandleScope scope;

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

  if (!info[0]->IsString()) {
    Nan::ThrowError("1st parameter must be a topic string");;
    return;
  }

  if (!info[1]->IsNumber()) {
    Nan::ThrowError("2nd parameter must be a partition number");
    return;
  }

  if (!info[2]->IsNumber()) {
    Nan::ThrowError("3rd parameter must be a number of milliseconds");
    return;
  }

  if (!info[3]->IsFunction()) {
    Nan::ThrowError("4th parameter must be a callback");
    return;
  }

  // Get string pointer for the topic name
  Nan::Utf8String topicUTF8(Nan::To<v8::String>(info[0]).ToLocalChecked());
  // The first parameter is the topic
  std::string topic_name(*topicUTF8);

  // Second parameter is the partition
  int32_t partition = Nan::To<int32_t>(info[1]).FromJust();

  // Third parameter is the timeout
  int timeout_ms = Nan::To<int>(info[2]).FromJust();

  // Fourth parameter is the callback
  v8::Local<v8::Function> cb = info[3].As<v8::Function>();
  Nan::Callback *callback = new Nan::Callback(cb);

  Nan::AsyncQueueWorker(new Workers::ConnectionQueryWatermarkOffsets(
    callback, obj, topic_name, partition, timeout_ms));

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Connection::NodeSetSaslCredentials) {
  if (!info[0]->IsString()) {
    Nan::ThrowError("1st parameter must be a username string");
    return;
  }

  if (!info[1]->IsString()) {
    Nan::ThrowError("2nd parameter must be a password string");
    return;
  }

  // Get string pointer for the username
  Nan::Utf8String usernameUTF8(Nan::To<v8::String>(info[0]).ToLocalChecked());
  // The first parameter is the username
  std::string username(*usernameUTF8);

  // Get string pointer for the password
  Nan::Utf8String passwordUTF8(Nan::To<v8::String>(info[1]).ToLocalChecked());
  // The first parameter is the password
  std::string password(*passwordUTF8);

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
  Baton b = obj->SetSaslCredentials(username, password);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    v8::Local<v8::Value> errorObject = b.ToObject();
    return Nan::ThrowError(errorObject);
  }

  info.GetReturnValue().Set(Nan::Null());
}


// Node methods
NAN_METHOD(Connection::NodeConfigureCallbacks) {
  Nan::HandleScope scope;

  if (info.Length() < 2 ||
    !info[0]->IsBoolean() ||
    !info[1]->IsObject()) {
    // Just throw an exception
    return Nan::ThrowError("Need to specify a callbacks object");
  }
  v8::Local<v8::Context> context = Nan::GetCurrentContext();
  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());

  const bool add = Nan::To<bool>(info[0]).ToChecked();
  v8::Local<v8::Object> configs_object =
    info[1]->ToObject(context).ToLocalChecked();
  v8::Local<v8::Array> configs_property_names =
    configs_object->GetOwnPropertyNames(context).ToLocalChecked();

  for (unsigned int j = 0; j < configs_property_names->Length(); ++j) {
    std::string configs_string_key;

    v8::Local<v8::Value> configs_key =
      Nan::Get(configs_property_names, j).ToLocalChecked();
    v8::Local<v8::Value> configs_value =
      Nan::Get(configs_object, configs_key).ToLocalChecked();

    int config_type = 0;
    if (configs_value->IsObject() && configs_key->IsString()) {
      Nan::Utf8String configs_utf8_key(configs_key);
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

    v8::Local<v8::Object> object =
      configs_value->ToObject(context).ToLocalChecked();
    v8::Local<v8::Array> property_names =
      object->GetOwnPropertyNames(context).ToLocalChecked();

    for (unsigned int i = 0; i < property_names->Length(); ++i) {
      std::string errstr;
      std::string string_key;

      v8::Local<v8::Value> key = Nan::Get(property_names, i).ToLocalChecked();
      v8::Local<v8::Value> value = Nan::Get(object, key).ToLocalChecked();

      if (key->IsString()) {
        Nan::Utf8String utf8_key(key);
        string_key = std::string(*utf8_key);
      } else {
        continue;
      }

      if (value->IsFunction()) {
        v8::Local<v8::Function> cb = value.As<v8::Function>();
        switch (config_type) {
          case 1:
            obj->m_gconfig->ConfigureCallback(string_key, cb, add, errstr);
            if (!errstr.empty()) {
              return Nan::ThrowError(errstr.c_str());
            }
            break;
          case 2:
            obj->m_tconfig->ConfigureCallback(string_key, cb, add, errstr);
            if (!errstr.empty()) {
              return Nan::ThrowError(errstr.c_str());
            }
            break;
          case 3:
            obj->ConfigureCallback(string_key, cb, add);
            break;
        }
      }
    }
  }

  info.GetReturnValue().Set(Nan::True());
}

NAN_METHOD(Connection::NodeSetOAuthBearerToken) {
  if (!info[0]->IsString()) {
    Nan::ThrowError("1st parameter must be a token string");
    return;
  }

  if (!info[1]->IsNumber()) {
    Nan::ThrowError("2nd parameter must be a lifetime_ms number");
    return;
  }

  if (!info[2]->IsString()) {
    Nan::ThrowError("3rd parameter must be a principal_name string");
    return;
  }

  if (!info[3]->IsNullOrUndefined() && !info[3]->IsArray()) {
    Nan::ThrowError("4th parameter must be an extensions array or null");
    return;
  }

  // Get string pointer for the token
  Nan::Utf8String tokenUtf8(Nan::To<v8::String>(info[0]).ToLocalChecked());
  std::string token(*tokenUtf8);

  // Get the lifetime_ms
  int64_t lifetime_ms = Nan::To<int64_t>(info[1]).FromJust();

  // Get string pointer for the principal_name
  Nan::Utf8String principal_nameUtf8(
      Nan::To<v8::String>(info[2]).ToLocalChecked());
  std::string principal_name(*principal_nameUtf8);

  // Get the extensions (if any)
  std::list<std::string> extensions;
  if (!info[3]->IsNullOrUndefined()) {
    v8::Local<v8::Array> extensionsArray = info[3].As<v8::Array>();
    extensions = v8ArrayToStringList(extensionsArray);
  }

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
  Baton b =
      obj->SetOAuthBearerToken(token, lifetime_ms, principal_name, extensions);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    v8::Local<v8::Value> errorObject = b.ToObject();
    return Nan::ThrowError(errorObject);
  }

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Connection::NodeSetOAuthBearerTokenFailure) {
  if (!info[0]->IsString()) {
    Nan::ThrowError("1st parameter must be an error string");
    return;
  }

  // Get string pointer for the error string
  Nan::Utf8String errstrUtf8(Nan::To<v8::String>(info[0]).ToLocalChecked());
  std::string errstr(*errstrUtf8);

  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
  Baton b = obj->SetOAuthBearerTokenFailure(errstr);

  if (b.err() != RdKafka::ERR_NO_ERROR) {
    v8::Local<v8::Value> errorObject = b.ToObject();
    return Nan::ThrowError(errorObject);
  }

  info.GetReturnValue().Set(Nan::Null());
}

NAN_METHOD(Connection::NodeName) {
  Connection* obj = ObjectWrap::Unwrap<Connection>(info.This());
  std::string name = obj->Name();
  info.GetReturnValue().Set(Nan::New(name).ToLocalChecked());
}

}  // namespace NodeKafka
