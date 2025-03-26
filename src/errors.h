/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#ifndef SRC_ERRORS_H_
#define SRC_ERRORS_H_

#include <napi.h>
#include <uv.h>
#include <iostream>
#include <string>

#include "rdkafkacpp.h" // NOLINT

#include "src/common.h"

namespace NodeKafka {

class Baton {
 public:
  explicit Baton(const RdKafka::ErrorCode &);
  explicit Baton(void* data);
  explicit Baton(const RdKafka::ErrorCode &, std::string);
  explicit Baton(const RdKafka::ErrorCode &, std::string, bool isFatal,
                 bool isRetriable, bool isTxnRequiresAbort);

  static Baton BatonFromErrorAndDestroy(rd_kafka_error_t *error);
  static Baton BatonFromErrorAndDestroy(RdKafka::Error *error);

  template<typename T> T data() {
    return static_cast<T>(m_data);
  }

  RdKafka::ErrorCode err();
  std::string errstr();

  Napi::Error ToError(const Napi::Env &env);
  Napi::Error ToTxnError(const Napi::Env &env);

 private:
  void* m_data;
  std::string m_errstr;
  RdKafka::ErrorCode m_err;
  bool m_isFatal;
  bool m_isRetriable;
  bool m_isTxnRequiresAbort;
};
  
Napi::Error RdKafkaError(const Napi::Env &env, const RdKafka::ErrorCode &);
Napi::Error RdKafkaError(const Napi::Env &env, const RdKafka::ErrorCode &, const std::string &);
Napi::Error RdKafkaError(const Napi::Env &env, const RdKafka::ErrorCode &err, std::string errstr,
                          bool isFatal, bool isRetriable,
                          bool isTxnRequiresAbort);

}  // namespace NodeKafka

#endif  // SRC_ERRORS_H_
