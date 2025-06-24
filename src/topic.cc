/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>

#include "src/connection.h"
#include "src/topic.h"

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

void Topic::Setup(std::string topic_name, RdKafka::Conf *config) {
  m_topic_name = topic_name;

  // We probably want to copy the config. May require refactoring if we do not
  m_config = config;
}

Topic::~Topic() {
  if (m_config) {
    delete m_config;
  }
}

std::string Topic::name() {
  return m_topic_name;
}

template <class T> Baton Topic::toRDKafkaTopic(Connection<T>* handle) {
  if (m_config) {
    return handle->CreateTopic(m_topic_name, m_config);
  } else {
    return handle->CreateTopic(m_topic_name);
  }
}

/*

bool partition_available(int32_t partition) {
  return topic_->partition_available(partition);
}

Baton offset_store (int32_t partition, int64_t offset) {
  RdKafka::ErrorCode err = topic_->offset_store(partition, offset);

  switch (err) {
    case RdKafka::ERR_NO_ERROR:

      break;
    default:

      break;
  }
}

*/

Napi::FunctionReference Topic::constructor;

void Topic::Init(const Napi::Env &env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function Topic = DefineClass(env, "Topic", {
      InstanceMethod("name", &Topic::NodeGetName),
    });

  // connect. disconnect. resume. pause. get meta data
  constructor.Reset(Topic);

  exports.Set(Napi::String::New(env, "Topic"), Topic);
}

Topic::Topic(const Napi::CallbackInfo &info): ObjectWrap<Topic>(info) {
  Napi::Env env = info.Env();
  if (!info.IsConstructCall()) {
    Napi::Error::New(env, "non-constructor invocation not supported").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 1) {
    Napi::Error::New(env, "topic name is required").ThrowAsJavaScriptException();
    return;
  }

  if (!info[0].IsString()) {
    Napi::Error::New(env, "Topic name must be a string").ThrowAsJavaScriptException();
    return;
  }

  RdKafka::Conf* config = NULL;

  if (info.Length() >= 2 && !info[1].IsUndefined() && !info[1].IsNull()) {
    // If they gave us two parameters, or the 3rd parameter is null or
    // undefined, we want to pass null in for the config

    std::string errstr;
    if (!info[1].IsObject()) {
      Napi::Error::New(env, "Configuration data must be specified").ThrowAsJavaScriptException();
      return;
    }

    config = Conf::create(RdKafka::Conf::CONF_TOPIC, info[1].ToObject(), errstr);  // NOLINT

    if (!config) {
      Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
      return;
    }
  }

  std::string parameterValue = info[0].ToString();
  std::string topic_name(parameterValue);

  this->Setup(topic_name, config);
}

Napi::Value Topic::NodeGetName(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  Topic* topic = this;

  return Napi::String::From(env, this->name());
}

Napi::Value Topic::NodePartitionAvailable(const Napi::CallbackInfo &info) {
  return info.Env().Null();
  // @TODO(sparente)
}

Napi::Value Topic::NodeOffsetStore(const Napi::CallbackInfo& info) {
  return info.Env().Null();
  // @TODO(sparente)
}

}  // namespace NodeKafka
