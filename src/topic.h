/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_TOPIC_H_
#define SRC_TOPIC_H_

#include <napi.h>
#include <uv.h>
#include <string>

#include "rdkafkacpp.h" // NOLINT

#include "src/config.h"

namespace NodeKafka {

class Topic : public Napi::ObjectWrap<Topic> {
 public:
  static void Init(Napi::Object);
  static Napi::Object NewInstance(Napi::Value arg);

  Baton toRDKafkaTopic(Connection *handle);

 protected:
  static Napi::FunctionReference constructor;
  static void New(const Napi::CallbackInfo& info);

  static Napi::Value NodeGetMetadata(const Napi::CallbackInfo& info);

  // TopicConfig * config_;

  std::string errstr;
  std::string name();

 private:
  Topic(std::string, RdKafka::Conf *);
  ~Topic();

  std::string m_topic_name;
  RdKafka::Conf * m_config;

  static Napi::Value NodeGetName(const Napi::CallbackInfo& info);
  static Napi::Value NodePartitionAvailable(const Napi::CallbackInfo& info);
  static Napi::Value NodeOffsetStore(const Napi::CallbackInfo& info);
};

}  // namespace NodeKafka

#endif  // SRC_TOPIC_H_
