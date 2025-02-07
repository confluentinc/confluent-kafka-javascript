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

#include <nan.h>
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

class Connection : public Nan::ObjectWrap {
 public:
  bool IsConnected() const;
  bool IsClosing() const;

  // Baton<RdKafka::Topic*>
  Baton CreateTopic(std::string);
  Baton CreateTopic(std::string, RdKafka::Conf*);
  Baton GetMetadata(bool, std::string, int);
  Baton QueryWatermarkOffsets(std::string, int32_t, int64_t*, int64_t*, int);
  Baton OffsetsForTimes(std::vector<RdKafka::TopicPartition*> &, int);
  Baton SetSaslCredentials(std::string, std::string);
  Baton SetOAuthBearerToken(const std::string&, int64_t, const std::string&,
                            const std::list<std::string>&);
  Baton SetOAuthBearerTokenFailure(const std::string&);

  RdKafka::Handle* GetClient();

  static RdKafka::TopicPartition* GetPartition(std::string &);
  static RdKafka::TopicPartition* GetPartition(std::string &, int);

  Callbacks::Event m_event_cb;

  virtual void ActivateDispatchers() = 0;
  virtual void DeactivateDispatchers() = 0;

  virtual void ConfigureCallback(
    const std::string &string_key, const v8::Local<v8::Function> &cb, bool add);

  std::string Name() const;

 protected:
  Connection(Conf*, Conf*);
  explicit Connection(Connection *);
  ~Connection();

  static Nan::Persistent<v8::Function> constructor;
  static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
  static Baton rdkafkaErrorToBaton(RdKafka::Error* error);

  Baton setupSaslOAuthBearerConfig();
  Baton setupSaslOAuthBearerBackgroundQueue();

  bool m_is_closing;

  Conf* m_gconfig;
  Conf* m_tconfig;
  std::string m_errstr;

  uv_rwlock_t m_connection_lock;
  bool m_has_underlying = false;

  RdKafka::Handle* m_client;

  static NAN_METHOD(NodeConfigureCallbacks);
  static NAN_METHOD(NodeGetMetadata);
  static NAN_METHOD(NodeQueryWatermarkOffsets);
  static NAN_METHOD(NodeOffsetsForTimes);
  static NAN_METHOD(NodeSetSaslCredentials);
  static NAN_METHOD(NodeSetOAuthBearerToken);
  static NAN_METHOD(NodeSetOAuthBearerTokenFailure);
  static NAN_METHOD(NodeName);
};

}  // namespace NodeKafka

#endif  // SRC_CONNECTION_H_
