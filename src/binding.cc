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
#include <iostream>
#include "src/binding.h"

using NodeKafka::Producer;
using NodeKafka::KafkaConsumer;
using NodeKafka::AdminClient;
using NodeKafka::Topic;

using RdKafka::ErrorCode;

Napi::Value NodeRdKafkaErr2Str(const Napi::CallbackInfo& info) {
  int points = info[0].As<Napi::Number>().Int32Value();
  // Cast to error code
  RdKafka::ErrorCode err = static_cast<RdKafka::ErrorCode>(points);

  std::string errstr = RdKafka::err2str(err);

  return Napi::String::New(env, errstr);
}

Napi::Value NodeRdKafkaBuildInFeatures(const Napi::CallbackInfo& info) {
  RdKafka::Conf * config = RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL);

  std::string features;

  if (RdKafka::Conf::CONF_OK == config->get("builtin.features", features)) {
    return Napi::String::New(env, features);
  } else {
    return env.Undefined();
  }

  delete config;
}

void ConstantsInit(Napi::Object exports) {
  Napi::Object topicConstants = Napi::Object::New(env);

  // RdKafka Error Code definitions
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::PARTITION_UA);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_BEGINNING);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_END);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_STORED);
  NODE_DEFINE_CONSTANT(topicConstants, RdKafka::Topic::OFFSET_INVALID);

  (exports).Set(Napi::String::New(env, "topic"), topicConstants);

  (exports).Set(Napi::String::New(env, "err2str"),
    Napi::GetFunction(Napi::Function::New(env, NodeRdKafkaErr2Str)));  // NOLINT

  (exports).Set(Napi::String::New(env, "features"),
    Napi::GetFunction(Napi::Function::New(env, NodeRdKafkaBuildInFeatures)));  // NOLINT
}

void Init(Napi::Object exports, Napi::Value m_, void* v_) {
  KafkaConsumer::Init(exports);
  Producer::Init(exports);
  AdminClient::Init(exports);
  Topic::Init(exports);
  ConstantsInit(exports);

  (exports).Set(Napi::String::New(env, "librdkafkaVersion"),
      Napi::New(env, RdKafka::version_str().c_str()));
}

NODE_API_MODULE(kafka, Init)
