/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include <string>
#include "src/binding.h"

using NodeKafka::AdminClient;
using NodeKafka::KafkaConsumer;
using NodeKafka::Producer;
using NodeKafka::Topic;

using Napi::Number;

Napi::Value NodeRdKafkaErr2Str(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  int points = info[0].As<Napi::Number>().Int32Value();
  // Cast to error code
  RdKafka::ErrorCode err = static_cast<RdKafka::ErrorCode>(points);

  std::string errstr = RdKafka::err2str(err);

  return Napi::String::New(env, errstr);
}

Napi::Value NodeRdKafkaBuildInFeatures(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  RdKafka::Conf * config = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);

  std::string features;

  if (RdKafka::Conf::CONF_OK == config->get("builtin.features", features)) {
    return Napi::String::New(env, features);
  } else {
    return env.Undefined();
  }

  delete config;
}

void defconst(Napi::Env env, Napi::Object target, const char *name, Napi::Value value) {
  target.Set(Napi::String::New(env, name), value);
}

void ConstantsInit(Napi::Env env, Napi::Object exports) {
  Napi::Object topicConstants = Napi::Object::New(env);

  // RdKafka Error Code definitions
  defconst(env, topicConstants, "RdKafka::Topic::PARTITION_UA", Number::New(env, RdKafka::Topic::PARTITION_UA));
  defconst(env, topicConstants, "RdKafka::Topic::OFFSET_BEGINNING", Number::New(env, RdKafka::Topic::OFFSET_BEGINNING));
  defconst(env, topicConstants, "RdKafka::Topic::OFFSET_END", Number::New(env, RdKafka::Topic::OFFSET_END));
  defconst(env, topicConstants, "RdKafka::Topic::OFFSET_STORED", Number::New(env, RdKafka::Topic::OFFSET_STORED));
  defconst(env, topicConstants, "RdKafka::Topic::OFFSET_INVALID", Number::New(env, RdKafka::Topic::OFFSET_INVALID));

  (exports).Set(Napi::String::New(env, "topic"), topicConstants);

  (exports).Set(Napi::String::New(env, "err2str"),Napi::Function::New(env, NodeRdKafkaErr2Str));  

  (exports).Set(Napi::String::New(env, "features"), Napi::Function::New(env, NodeRdKafkaBuildInFeatures)); 
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  KafkaConsumer::Init(env, exports);
  Producer::Init(env, exports);
  AdminClient::Init(env, exports);
  Topic::Init(env, exports);
  ConstantsInit(env, exports);

  (exports).Set(Napi::String::New(env, "librdkafkaVersion"),
                Napi::String::New(env, RdKafka::version_str().c_str()));
  return exports;
}

NODE_API_MODULE(kafka, Init)
