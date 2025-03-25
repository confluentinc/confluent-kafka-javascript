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

#include "src/errors.h"

namespace NodeKafka {

Napi::Object RdKafkaError(const RdKafka::ErrorCode &err,
                                   const std::string &errstr) {
  int code = static_cast<int>(err);

  Napi::Object ret = Napi::Object::New(env);

  (ret).Set(Napi::String::New(env, "message"),
    Napi::String::New(env, errstr));
  (ret).Set(Napi::String::New(env, "code"),
    Napi::Number::New(env, code));

  return ret;
}

Napi::Object RdKafkaError(const RdKafka::ErrorCode &err) {
  std::string errstr = RdKafka::err2str(err);
  return RdKafkaError(err, errstr);
}

Napi::Object RdKafkaError(
  const RdKafka::ErrorCode &err, std::string errstr,
  bool isFatal, bool isRetriable, bool isTxnRequiresAbort) {
  Napi::Object ret = RdKafkaError(err, errstr);

  (ret).Set(Napi::String::New(env, "isFatal"),
    Napi::Boolean::New(env, isFatal));
  (ret).Set(Napi::String::New(env, "isRetriable"),
    Napi::Boolean::New(env, isRetriable));
  (ret).Set(Napi::String::New(env, "isTxnRequiresAbort"),
    Napi::Boolean::New(env, isTxnRequiresAbort));

  return ret;
}

Baton::Baton(const RdKafka::ErrorCode &code) {
  m_err = code;
}

Baton::Baton(const RdKafka::ErrorCode &code, std::string errstr) {
  m_err = code;
  m_errstr = errstr;
}

Baton::Baton(void* data) {
  m_err = RdKafka::ERR_NO_ERROR;
  m_data = data;
}

Baton::Baton(const RdKafka::ErrorCode &code, std::string errstr, bool isFatal,
             bool isRetriable, bool isTxnRequiresAbort) {
  m_err = code;
  m_errstr = errstr;
  m_isFatal = isFatal;
  m_isRetriable = isRetriable;
  m_isTxnRequiresAbort = isTxnRequiresAbort;
}

/**
 * Creates a Baton from an rd_kafka_error_t* and destroys it.
 */
Baton Baton::BatonFromErrorAndDestroy(rd_kafka_error_t *error) {
  std::string errstr = rd_kafka_error_string(error);
  RdKafka::ErrorCode err =
      static_cast<RdKafka::ErrorCode>(rd_kafka_error_code(error));
  rd_kafka_error_destroy(error);
  return Baton(err, errstr);
}

/**
 * Creates a Baton from an RdKafka::Error* and deletes it.
 */
Baton Baton::BatonFromErrorAndDestroy(RdKafka::Error *error) {
  std::string errstr = error->str();
  RdKafka::ErrorCode err = error->code();
  delete error;
  return Baton(err, errstr);
}

Napi::Object Baton::ToObject() {
  if (m_errstr.empty()) {
    return RdKafkaError(m_err);
  } else {
    return RdKafkaError(m_err, m_errstr);
  }
}

Napi::Object Baton::ToTxnObject() {
  return RdKafkaError(m_err, m_errstr, m_isFatal, m_isRetriable, m_isTxnRequiresAbort); // NOLINT
}

RdKafka::ErrorCode Baton::err() {
  return m_err;
}

std::string Baton::errstr() {
  if (m_errstr.empty()) {
    return RdKafka::err2str(m_err);
  } else {
    return m_errstr;
  }
}

}  // namespace NodeKafka
