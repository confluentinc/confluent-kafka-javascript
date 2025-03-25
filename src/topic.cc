/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>
#include <vector>

#include "src/common.h"
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

Topic::Topic(std::string topic_name, RdKafka::Conf* config):
  m_topic_name(topic_name),
  m_config(config) {
  // We probably want to copy the config. May require refactoring if we do not
}

Topic::~Topic() {
  if (m_config) {
    delete m_config;
  }
}

std::string Topic::name() {
  return m_topic_name;
}

Baton Topic::toRDKafkaTopic(Connection* handle) {
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

void Topic::Init(Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::FunctionReference tpl = Napi::Function::New(env, New);
  tpl->SetClassName(Napi::String::New(env, "Topic"));


  InstanceMethod("name", &NodeGetName),

  // connect. disconnect. resume. pause. get meta data
  constructor.Reset((tpl->GetFunction(Napi::GetCurrentContext()))
    );

  (exports).Set(Napi::String::New(env, "Topic"),
    tpl->GetFunction(Napi::GetCurrentContext()));
}

void Topic::New(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!info.IsConstructCall()) {
    Napi::Error::New(env, "non-constructor invocation not supported").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (info.Length() < 1) {
    Napi::Error::New(env, "topic name is required").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    Napi::Error::New(env, "Topic name must be a string").ThrowAsJavaScriptException();
    return env.Null();
  }

  RdKafka::Conf* config = NULL;

  if (info.Length() >= 2 && !info[1].IsUndefined() && !info[1].IsNull()) {
    // If they gave us two parameters, or the 3rd parameter is null or
    // undefined, we want to pass null in for the config

    std::string errstr;
    if (!info[1].IsObject()) {
      Napi::Error::New(env, "Configuration data must be specified").ThrowAsJavaScriptException();
      return env.Null();
    }

    config = Conf::create(RdKafka::Conf::CONF_TOPIC, (info[1].ToObject(Napi::GetCurrentContext())), errstr);  // NOLINT

    if (!config) {
      Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  std::string parameterValue = info[0].As<Napi::String>(.To<Napi::String>());
  std::string topic_name(*parameterValue);

  Topic* topic = new Topic(topic_name, config);

  // Wrap it
  topic->Wrap(info.This());

  // Then there is some weird initialization that happens
  // basically it sets the configuration data
  // we don't need to do that because we lazy load it

  return info.This();
}

// handle

Napi::Object Topic::NewInstance(Napi::Value arg) {
  Napi::Env env = arg.Env();
  Napi::EscapableHandleScope scope(env);

  const unsigned argc = 1;

  Napi::Value argv[argc] = { arg };
  Napi::Function cons = Napi::Function::New(env, constructor);
  Napi::Object instance =
    Napi::NewInstance(cons, argc, argv);

  return scope.Escape(instance);
}

Napi::Value Topic::NodeGetName(const Napi::CallbackInfo& info) {
  Napi::HandleScope scope(env);

  Topic* topic = ObjectWrap::Unwrap<Topic>(info.This());

  return Napi::New(env, topic->name());
}

Napi::Value Topic::NodePartitionAvailable(const Napi::CallbackInfo& info) {
  // @TODO(sparente)
}

Napi::Value Topic::NodeOffsetStore(const Napi::CallbackInfo& info) {
  // @TODO(sparente)
}

}  // namespace NodeKafka
