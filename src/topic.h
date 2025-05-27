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
#include "src/connection.h"

namespace NodeKafka {

class Topic : public Napi::ObjectWrap<Topic> {
 public:
  static void Init(const Napi::Env &, Napi::Object);
  Topic(const Napi::CallbackInfo& info);

  template <class T> Baton toRDKafkaTopic(Connection<T> *handle);

 protected:
  static Napi::FunctionReference constructor;

  Napi::Value NodeGetMetadata(const Napi::CallbackInfo& info);

  // TopicConfig * config_;

  std::string errstr;
  std::string name();

 private:
  void Setup(std::string, RdKafka::Conf *);
  ~Topic();

  std::string m_topic_name;
  RdKafka::Conf * m_config;

  Napi::Value NodeGetName(const Napi::CallbackInfo& info);
  Napi::Value NodePartitionAvailable(const Napi::CallbackInfo& info);
  Napi::Value NodeOffsetStore(const Napi::CallbackInfo& info);
};

}  // namespace NodeKafka

#endif  // SRC_TOPIC_H_
