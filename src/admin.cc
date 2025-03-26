/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2023 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

#include "src/admin.h"

#include <math.h>
#include <string>
#include <vector>

#include "src/workers.h"

using Napi::CallbackInfo;

namespace NodeKafka {

/**
 * @brief AdminClient v8 wrapped object.
 *
 * Specializes the connection to wrap a producer object through compositional
 * inheritence. Establishes its prototype in node through `Init`
 *
 * @sa RdKafka::Handle
 * @sa NodeKafka::Client
 */

AdminClient::~AdminClient() {
  Disconnect();
}

Baton AdminClient::Connect() {
  if (IsConnected()) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  /* We should never fail the IsConnected check when we have an underlying
   * client, as it should always be connected. */
  if (m_has_underlying) {
    return Baton(RdKafka::ERR__STATE,
                 "Existing client is not connected, and dependent client "
                 "cannot initiate connection.");
  }

  Baton baton = setupSaslOAuthBearerConfig();
  if (baton.err() != RdKafka::ERR_NO_ERROR) {
    return baton;
  }

  std::string errstr;
  {
    scoped_shared_write_lock lock(m_connection_lock);
    m_client = RdKafka::Producer::create(m_gconfig, errstr);
  }

  if (!m_client || !errstr.empty()) {
    DeactivateDispatchers();
    return Baton(RdKafka::ERR__STATE, errstr);
  }

  /* Set the client name at the first possible opportunity for logging. */
  m_event_cb.dispatcher.SetClientName(m_client->name());

  baton = setupSaslOAuthBearerBackgroundQueue();
  if (baton.err() != RdKafka::ERR_NO_ERROR) {
    DeactivateDispatchers();
  }

  return baton;
}

Baton AdminClient::Disconnect() {
  /* Dependent AdminClients don't need to do anything. We block the call to
   * disconnect in JavaScript, but the destructor of AdminClient might trigger
   * this call. */
  if (m_has_underlying) {
    return Baton(RdKafka::ERR_NO_ERROR);
  }

  if (IsConnected()) {
    scoped_shared_write_lock lock(m_connection_lock);

    DeactivateDispatchers();

    delete m_client;
    m_client = NULL;
  }

  return Baton(RdKafka::ERR_NO_ERROR);
}

Napi::FunctionReference AdminClient::constructor;

void AdminClient::Init(const Napi::Env& env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function AdminClient = DefineClass(env, "AdminClient", {
      // Inherited from NodeKafka::Connection
      InstanceMethod("configureCallbacks", &AdminClient::NodeConfigureCallbacks),
      InstanceMethod("name", &AdminClient::NodeName),      
      InstanceMethod("setOAuthBearerToken", &AdminClient::NodeSetOAuthBearerToken),
      StaticMethod("setOAuthBearerTokenFailure",
		   &NodeSetOAuthBearerTokenFailure),

      // Admin client operations
      InstanceMethod("createTopic", &AdminClient::NodeCreateTopic),
      InstanceMethod("deleteTopic", &AdminClient::NodeDeleteTopic),
      InstanceMethod("createPartitions", &AdminClient::NodeCreatePartitions),
      InstanceMethod("deleteRecords", &AdminClient::NodeDeleteRecords),
      InstanceMethod("describeTopics", &AdminClient::NodeDescribeTopics),
      InstanceMethod("listOffsets", &AdminClient::NodeListOffsets),

      // Consumer group related operations
      InstanceMethod("listGroups", &AdminClient::NodeListGroups),
      InstanceMethod("describeGroups", &AdminClient::NodeDescribeGroups),
      InstanceMethod("deleteGroups", &AdminClient::NodeDeleteGroups),
      InstanceMethod("listConsumerGroupOffsets",&AdminClient::NodeListConsumerGroupOffsets),
      InstanceMethod("connect", &AdminClient::NodeConnect),
      InstanceMethod("disconnect", &AdminClient::NodeDisconnect),
      InstanceMethod("setSaslCredentials", &AdminClient::NodeSetSaslCredentials),
      InstanceMethod("getMetadata", &AdminClient::NodeGetMetadata),
    });
    
  constructor.Reset(AdminClient);
  exports.Set(Napi::String::New(env, "AdminClient"), AdminClient);
}

AdminClient::AdminClient(const Napi::CallbackInfo& info): Connection(info) {
  Napi::Env env = info.Env();
  if (!info.IsConstructCall()) {
    Napi::Error::New(env, "non-constructor invocation not supported").ThrowAsJavaScriptException();
    return;
  }

  if (info.Length() < 1) {
    Napi::Error::New(env, "You must supply a global configuration or a preexisting client").ThrowAsJavaScriptException();
    return;
  }

  Connection *connection = NULL;
  Conf *gconfig = NULL;
  AdminClient *client = NULL;

  if (info.Length() >= 3 && !info[2].IsNull() && !info[2].IsUndefined()) {
    if (!info[2].IsObject()) {
      Napi::Error::New(env, "Third argument, if provided, must be a client object").ThrowAsJavaScriptException();
      return;
    }
    // We check whether this is a wrapped object within the calling JavaScript
    // code, so it's safe to unwrap it here. We Unwrap it directly into a
    // Connection object, since it's OK to unwrap into the parent class.
    connection = ObjectWrap<AdminClient>::Unwrap(info[2].ToObject());
    this->ConfigFromExisting(connection);    
  } else {
    if (!info[0].IsObject()) {
      Napi::Error::New(env, "Global configuration data must be specified").ThrowAsJavaScriptException();
      return;
    }

    std::string errstr;
    gconfig = Conf::create(RdKafka::Conf::CONF_GLOBAL, info[0].ToObject(), errstr);

    if (!gconfig) {
      Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
      return;
    }
    this->Config(gconfig, NULL);
  }
}

/**
 * Poll for a particular event on a queue.
 *
 * This will keep polling until it gets an event of that type,
 * given the number of tries and a timeout
 */
rd_kafka_event_t* PollForEvent(
  rd_kafka_queue_t * topic_rkqu,
  rd_kafka_event_type_t event_type,
  int timeout_ms) {
  // Initiate exponential timeout
  int attempts = 1;
  int exp_timeout_ms = timeout_ms;
  if (timeout_ms > 2000) {
    // measure optimal number of attempts
    attempts = log10(timeout_ms / 1000) / log10(2) + 1;
    // measure initial exponential timeout based on attempts
    exp_timeout_ms = timeout_ms / (pow(2, attempts) - 1);
  }

  rd_kafka_event_t * event_response = nullptr;

  // Poll the event queue until we get it
  do {
    // free previously fetched event
    rd_kafka_event_destroy(event_response);
    // poll and update attempts and exponential timeout
    event_response = rd_kafka_queue_poll(topic_rkqu, exp_timeout_ms);
    attempts = attempts - 1;
    exp_timeout_ms = 2 * exp_timeout_ms;
  } while (
    rd_kafka_event_type(event_response) != event_type &&
    attempts > 0);

  // TODO: change this function so a type mismatch leads to an INVALID_TYPE
  // error rather than a null event. A null event is treated as a timeout, which
  // isn't true all the time.
  // If this isn't the type of response we want, or if we do not have a response
  // type, bail out with a null
  if (event_response == NULL ||
    rd_kafka_event_type(event_response) != event_type) {
    rd_kafka_event_destroy(event_response);
    return NULL;
  }

  return event_response;
}

Baton AdminClient::CreateTopic(rd_kafka_NewTopic_t* topic, int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are creating topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_CREATETOPICS);

    // Create queue just for this operation
    rd_kafka_queue_t * topic_rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_CreateTopics(m_client->c_ptr(), &topic, 1, options, topic_rkqu);

    // Poll for an event by type in that queue
    rd_kafka_event_t * event_response = PollForEvent(
      topic_rkqu,
      RD_KAFKA_EVENT_CREATETOPICS_RESULT,
      timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(topic_rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(event_response);
      rd_kafka_event_destroy(event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // get the created results
    const rd_kafka_CreateTopics_result_t * create_topic_results =
      rd_kafka_event_CreateTopics_result(event_response);

    size_t created_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_CreateTopics_result_topics(  // NOLINT
      create_topic_results,
      &created_topic_count);

    for (int i = 0 ; i < static_cast<int>(created_topic_count) ; i++) {
      const rd_kafka_topic_result_t *terr = restopics[i];
      const rd_kafka_resp_err_t errcode = rd_kafka_topic_result_error(terr);
      const char *errmsg = rd_kafka_topic_result_error_string(terr);

      if (errcode != RD_KAFKA_RESP_ERR_NO_ERROR) {
        if (errmsg) {
          const std::string errormsg = std::string(errmsg);
          rd_kafka_event_destroy(event_response);
          return Baton(static_cast<RdKafka::ErrorCode>(errcode), errormsg); // NOLINT
        } else {
          rd_kafka_event_destroy(event_response);
          return Baton(static_cast<RdKafka::ErrorCode>(errcode));
        }
      }
    }

    rd_kafka_event_destroy(event_response);
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::DeleteTopic(rd_kafka_DeleteTopic_t* topic, int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are deleting topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_DELETETOPICS);

    // Create queue just for this operation.
    // May be worth making a "scoped queue" class or something like a lock
    // for RAII
    rd_kafka_queue_t * topic_rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_DeleteTopics(m_client->c_ptr(), &topic, 1, options, topic_rkqu);

    // Poll for an event by type in that queue
    rd_kafka_event_t * event_response = PollForEvent(
      topic_rkqu,
      RD_KAFKA_EVENT_DELETETOPICS_RESULT,
      timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(topic_rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(event_response);
      rd_kafka_event_destroy(event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // get the created results
    const rd_kafka_DeleteTopics_result_t * delete_topic_results =
      rd_kafka_event_DeleteTopics_result(event_response);

    size_t deleted_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_DeleteTopics_result_topics(  // NOLINT
      delete_topic_results,
      &deleted_topic_count);

    for (int i = 0 ; i < static_cast<int>(deleted_topic_count) ; i++) {
      const rd_kafka_topic_result_t *terr = restopics[i];
      const rd_kafka_resp_err_t errcode = rd_kafka_topic_result_error(terr);

      if (errcode != RD_KAFKA_RESP_ERR_NO_ERROR) {
        rd_kafka_event_destroy(event_response);
        return Baton(static_cast<RdKafka::ErrorCode>(errcode));
      }
    }

    rd_kafka_event_destroy(event_response);
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::CreatePartitions(
  rd_kafka_NewPartitions_t* partitions,
  int timeout_ms) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are deleting topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
      m_client->c_ptr(), RD_KAFKA_ADMIN_OP_CREATEPARTITIONS);

    // Create queue just for this operation.
    // May be worth making a "scoped queue" class or something like a lock
    // for RAII
    rd_kafka_queue_t * topic_rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_CreatePartitions(m_client->c_ptr(),
      &partitions, 1, options, topic_rkqu);

    // Poll for an event by type in that queue
    rd_kafka_event_t * event_response = PollForEvent(
      topic_rkqu,
      RD_KAFKA_EVENT_CREATEPARTITIONS_RESULT,
      timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(topic_rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(event_response);
      rd_kafka_event_destroy(event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // get the created results
    const rd_kafka_CreatePartitions_result_t * create_partitions_results =
      rd_kafka_event_CreatePartitions_result(event_response);

    size_t created_partitions_topic_count;
    const rd_kafka_topic_result_t **restopics = rd_kafka_CreatePartitions_result_topics(  // NOLINT
      create_partitions_results,
      &created_partitions_topic_count);

    for (int i = 0 ; i < static_cast<int>(created_partitions_topic_count) ; i++) {  // NOLINT
      const rd_kafka_topic_result_t *terr = restopics[i];
      const rd_kafka_resp_err_t errcode = rd_kafka_topic_result_error(terr);
      const char *errmsg = rd_kafka_topic_result_error_string(terr);

      if (errcode != RD_KAFKA_RESP_ERR_NO_ERROR) {
        if (errmsg) {
          const std::string errormsg = std::string(errmsg);
          rd_kafka_event_destroy(event_response);
          return Baton(static_cast<RdKafka::ErrorCode>(errcode), errormsg); // NOLINT
        } else {
          rd_kafka_event_destroy(event_response);
          return Baton(static_cast<RdKafka::ErrorCode>(errcode));
        }
      }
    }

    rd_kafka_event_destroy(event_response);
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::ListGroups(
    bool is_match_states_set,
    std::vector<rd_kafka_consumer_group_state_t> &match_states, int timeout_ms,
    /* out */ rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are listing groups
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_LISTCONSUMERGROUPS);

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    if (is_match_states_set) {
      rd_kafka_error_t *error =
          rd_kafka_AdminOptions_set_match_consumer_group_states(
              options, &match_states[0], match_states.size());
      if (error) {
        return Baton::BatonFromErrorAndDestroy(error);
      }
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_ListConsumerGroups(m_client->c_ptr(), options, rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response = PollForEvent(
        rkqu, RD_KAFKA_EVENT_LISTCONSUMERGROUPS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::DescribeGroups(std::vector<std::string> &groups,
                                  bool include_authorized_operations,
                                  int timeout_ms,
                                  /* out */ rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are describing groups
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_DESCRIBECONSUMERGROUPS);

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    if (include_authorized_operations) {
      rd_kafka_error_t *error =
          rd_kafka_AdminOptions_set_include_authorized_operations(
              options, include_authorized_operations);
      if (error) {
        return Baton::BatonFromErrorAndDestroy(error);
      }
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    // Construct a char** to pass to librdkafka. Avoid too many allocations.
    std::vector<const char *> c_groups(groups.size());
    for (size_t i = 0; i < groups.size(); i++) {
      c_groups[i] = groups[i].c_str();
    }

    rd_kafka_DescribeConsumerGroups(m_client->c_ptr(), &c_groups[0],
                                    groups.size(), options, rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response = PollForEvent(
        rkqu, RD_KAFKA_EVENT_DESCRIBECONSUMERGROUPS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::DeleteGroups(rd_kafka_DeleteGroup_t **group_list,
                                size_t group_cnt, int timeout_ms,
                                /* out */ rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are deleting groups
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_DELETEGROUPS);

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_DeleteGroups(m_client->c_ptr(), group_list, group_cnt, options,
                          rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response =
        PollForEvent(rkqu, RD_KAFKA_EVENT_DELETEGROUPS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::ListConsumerGroupOffsets(
    rd_kafka_ListConsumerGroupOffsets_t **req, size_t req_cnt,
    bool require_stable_offsets, int timeout_ms,
    rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are fetching offsets
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_LISTCONSUMERGROUPOFFSETS);

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    if (require_stable_offsets) {
      rd_kafka_error_t *error =
          rd_kafka_AdminOptions_set_require_stable_offsets(
              options, require_stable_offsets);
      if (error) {
        return Baton::BatonFromErrorAndDestroy(error);
      }
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_ListConsumerGroupOffsets(m_client->c_ptr(), req, req_cnt, options,
                                      rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response = PollForEvent(
        rkqu, RD_KAFKA_EVENT_LISTCONSUMERGROUPOFFSETS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::DeleteRecords(rd_kafka_DeleteRecords_t **del_records,
                                 size_t del_records_cnt,
                                 int operation_timeout_ms, int timeout_ms,
                                 rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are deleting records
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_DELETERECORDS);

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    err = rd_kafka_AdminOptions_set_operation_timeout(
        options, operation_timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_DeleteRecords(m_client->c_ptr(), del_records,
                           del_records_cnt, options, rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response =
        PollForEvent(rkqu, RD_KAFKA_EVENT_DELETERECORDS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

Baton AdminClient::DescribeTopics(rd_kafka_TopicCollection_t *topics,
                                  bool include_authorized_operations,
                                  int timeout_ms,
                                  rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are describing topics
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_DESCRIBETOPICS);

    if (include_authorized_operations) {
      rd_kafka_error_t *error =
          rd_kafka_AdminOptions_set_include_authorized_operations(
              options, include_authorized_operations);
      if (error) {
        return Baton::BatonFromErrorAndDestroy(error);
      }
    }

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_DescribeTopics(m_client->c_ptr(), topics, options, rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response =
        PollForEvent(rkqu, RD_KAFKA_EVENT_DESCRIBETOPICS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}


Baton AdminClient::ListOffsets(rd_kafka_topic_partition_list_t *partitions,
                               int timeout_ms,
                               rd_kafka_IsolationLevel_t isolation_level,
                               rd_kafka_event_t **event_response) {
  if (!IsConnected()) {
    return Baton(RdKafka::ERR__STATE);
  }

  {
    scoped_shared_write_lock lock(m_connection_lock);
    if (!IsConnected()) {
      return Baton(RdKafka::ERR__STATE);
    }

    // Make admin options to establish that we are fetching offsets
    rd_kafka_AdminOptions_t *options = rd_kafka_AdminOptions_new(
        m_client->c_ptr(), RD_KAFKA_ADMIN_OP_LISTOFFSETS);

    char errstr[512];
    rd_kafka_resp_err_t err = rd_kafka_AdminOptions_set_request_timeout(
        options, timeout_ms, errstr, sizeof(errstr));
    if (err != RD_KAFKA_RESP_ERR_NO_ERROR) {
      return Baton(static_cast<RdKafka::ErrorCode>(err), errstr);
    }

    rd_kafka_error_t *error =
        rd_kafka_AdminOptions_set_isolation_level(options, isolation_level);
    if (error) {
      return Baton::BatonFromErrorAndDestroy(error);
    }

    // Create queue just for this operation.
    rd_kafka_queue_t *rkqu = rd_kafka_queue_new(m_client->c_ptr());

    rd_kafka_ListOffsets(m_client->c_ptr(), partitions, options, rkqu);

    // Poll for an event by type in that queue
    // DON'T destroy the event. It is the out parameter, and ownership is
    // the caller's.
    *event_response =
        PollForEvent(rkqu, RD_KAFKA_EVENT_LISTOFFSETS_RESULT, timeout_ms);

    // Destroy the queue since we are done with it.
    rd_kafka_queue_destroy(rkqu);

    // Destroy the options we just made because we polled already
    rd_kafka_AdminOptions_destroy(options);

    // If we got no response from that operation, this is a failure
    // likely due to time out
    if (*event_response == NULL) {
      return Baton(RdKafka::ERR__TIMED_OUT);
    }

    // Now we can get the error code from the event
    if (rd_kafka_event_error(*event_response)) {
      // If we had a special error code, get out of here with it
      const rd_kafka_resp_err_t errcode = rd_kafka_event_error(*event_response);
      return Baton(static_cast<RdKafka::ErrorCode>(errcode));
    }

    // At this point, event_response contains the result, which needs
    // to be parsed/converted by the caller.
    return Baton(RdKafka::ERR_NO_ERROR);
  }
}

void AdminClient::ActivateDispatchers() {
  // Listen to global config
  m_gconfig->listen();

  // Listen to non global config
  // tconfig->listen();

  // This should be refactored to config based management
  m_event_cb.dispatcher.Activate();
}
void AdminClient::DeactivateDispatchers() {
  // Stop listening to the config dispatchers
  m_gconfig->stop();

  // Also this one
  m_event_cb.dispatcher.Deactivate();
}

/**
 * @section
 * C++ Exported prototype functions
 */

Napi::Value AdminClient::NodeConnect(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();  
  Napi::HandleScope scope(env);

  // Activate the dispatchers before the connection, as some callbacks may run
  // on the background thread.
  // We will deactivate them if the connection fails.
  // Because the Admin Client connect is synchronous, we can do this within
  // AdminClient::Connect as well, but we do it here to keep the code similiar
  // to the Producer and Consumer.
  this->ActivateDispatchers();

  Baton b = this->Connect();
  // Let the JS library throw if we need to so the error can be more rich
  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

Napi::Value AdminClient::NodeDisconnect(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();  
  Napi::HandleScope scope(env);

  Baton b = this->Disconnect();
  // Let the JS library throw if we need to so the error can be more rich
  int error_code = static_cast<int>(b.err());
  return Napi::Number::New(env, error_code);
}

/**
 * Create topic
 */
Napi::Value AdminClient::NodeCreateTopic(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsNumber()) {
    Napi::Error::New(env, "Must provide 'timeout'").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  AdminClient* client = this;

  // Get the timeout
  int timeout = info[1].As<Napi::Number>().Int32Value();

  std::string errstr;
  // Get that topic we want to create
  rd_kafka_NewTopic_t* topic = Conversion::Admin::FromV8TopicObject(
    info[0].As<Napi::Object>(), errstr);

  if (topic == NULL) {
    Napi::Error::New(env, errstr.c_str()).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Queue up dat work
  Napi::AsyncWorker* worker = new Workers::AdminClientCreateTopic(callback, client, topic, timeout);
  worker->Queue();
  return env.Null();
}

/**
 * Delete topic
 */
Napi::Value AdminClient::NodeDeleteTopic(const Napi::CallbackInfo &info) {
  const Napi::Env env = info.Env();  
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    // Just throw an exception
    return ThrowError(env, "Need to specify a callback");
  }

  if (!info[1].IsNumber() || !info[0].IsString()) {
    return ThrowError(env, "Must provide 'timeout', and 'topicName'");
  }

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  AdminClient* client = this;

  // Get the topic name from the string
  std::string topic_name = Util::FromV8String(info[0].ToString());

  // Get the timeout
  int timeout = info[1].As<Napi::Number>().Int32Value();

  // Get that topic we want to create
  rd_kafka_DeleteTopic_t* topic = rd_kafka_DeleteTopic_new(
    topic_name.c_str());

  // Queue up dat work
  Napi::AsyncWorker* worker = new Workers::AdminClientDeleteTopic(callback, client, topic, timeout);
  worker->Queue();
  return env.Null();
}

/**
 * Delete topic
 */
Napi::Value AdminClient::NodeCreatePartitions(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 4) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[3].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback 2").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[2].IsNumber() || !info[1].IsNumber() || !info[0].IsString()) {
    return ThrowError(env,
      "Must provide 'totalPartitions', 'timeout', and 'topicName'");
  }

  // Create the final callback object
  Napi::Function cb = info[3].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  
  AdminClient* client = this;

  // Get the timeout
  int timeout = info[2].As<Napi::Number>().Int32Value();

  // Get the total number of desired partitions
  int partition_total_count = info[1].As<Napi::Number>().Int32Value();

  // Get the topic name from the string
  std::string topic_name = Util::FromV8String(info[0].ToString());

  // Create an error buffer we can throw
  char* errbuf = reinterpret_cast<char*>(malloc(100));

  // Create the new partitions request
  rd_kafka_NewPartitions_t* new_partitions = rd_kafka_NewPartitions_new(
    topic_name.c_str(), partition_total_count, errbuf, 100);

  // If we got a failure on the create new partitions request,
  // fail here
  if (new_partitions == NULL) {
    Napi::Error::New(env, errbuf).ThrowAsJavaScriptException();
    return env.Null();
  }

  // Queue up dat work
  Napi::AsyncWorker* worker = new Workers::AdminClientCreatePartitions(
    callback, client, new_partitions, timeout);

  worker->Queue();
  return env.Null();
}

/**
 * List Consumer Groups.
 */
Napi::Value AdminClient::NodeListGroups(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();  
  Napi::HandleScope scope(env);

  if (info.Length() < 2 || !info[1].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsObject()) {
    Napi::Error::New(env, "Must provide options object").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object config = info[0].As<Napi::Object>();

  // Create the final callback object
  Napi::Function cb = info[1].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  
  AdminClient *client = this;

  // Get the timeout - default 5000.
  int timeout_ms = GetParameter<int64_t>(config, "timeout", 5000);

  // Get the match states, or not if they are unset.
  std::vector<rd_kafka_consumer_group_state_t> match_states;
  Napi::String match_consumer_group_states_key =
      Napi::String::New(env, "matchConsumerGroupStates");
  bool is_match_states_set = config.Has(match_consumer_group_states_key);
  Napi::Array match_states_array = Napi::Array::New(env);

  if (is_match_states_set) {
    match_states_array = GetParameter<Napi::Array>(
        config, "matchConsumerGroupStates", match_states_array);
    if (match_states_array.Length()) {
      match_states = Conversion::Admin::FromV8GroupStateArray(
        match_states_array);
    }
  }

  // Queue the work.
  Napi::AsyncWorker *worker = new Workers::AdminClientListGroups(
      callback, client, is_match_states_set, match_states, timeout_ms);
  worker->Queue();
  
  return env.Null();
}

/**
 * Describe Consumer Groups.
 */
Napi::Value AdminClient::NodeDescribeGroups(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    // Just throw an exception
    return ThrowError(env, "Need to specify a callback");
  }

  if (!info[0].IsArray()) {
    return ThrowError(env, "Must provide group name array");
  }

  if (!info[1].IsObject()) {
    return ThrowError(env, "Must provide options object");
  }

  // Get list of group names to describe.
  Napi::Array group_names = info[0].As<Napi::Array>();
  if (group_names.Length() == 0) {
    return ThrowError(env, "Must provide at least one group name");
  }
  std::vector<std::string> group_names_vector =
      v8ArrayToStringVector(group_names);

  Napi::Object config = info[1].As<Napi::Object>();

  // Get the timeout - default 5000.
  int timeout_ms = GetParameter<int64_t>(config, "timeout", 5000);

  // Get whether to include authorized operations - default false.
  bool include_authorized_operations =
      GetParameter<bool>(config, "includeAuthorizedOperations", false);

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  AdminClient *client = this;

  // Queue the work.
  Napi::AsyncWorker *worker = new Workers::AdminClientDescribeGroups(
      callback, client, group_names_vector, include_authorized_operations,
      timeout_ms);
  worker->Queue();
  return env.Null();
}

/**
 * Delete Consumer Groups.
 */
Napi::Value AdminClient::NodeDeleteGroups(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    // Just throw an exception
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Must provide group name array").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsObject()) {
    Napi::Error::New(env, "Must provide options object").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Get list of group names to delete, and convert it into an
  // rd_kafka_DeleteGroup_t array.
  Napi::Array group_names = info[0].As<Napi::Array>();
  if (group_names.Length() == 0) {
    Napi::Error::New(env, "Must provide at least one group name").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::vector<std::string> group_names_vector =
      v8ArrayToStringVector(group_names);

  // The ownership of this array is transferred to the worker.
  rd_kafka_DeleteGroup_t **group_list = static_cast<rd_kafka_DeleteGroup_t **>(
      malloc(sizeof(rd_kafka_DeleteGroup_t *) * group_names_vector.size()));
  for (size_t i = 0; i < group_names_vector.size(); i++) {
    group_list[i] = rd_kafka_DeleteGroup_new(group_names_vector[i].c_str());
  }

  Napi::Object config = info[1].As<Napi::Object>();

  // Get the timeout - default 5000.
  int timeout_ms = GetParameter<int64_t>(config, "timeout", 5000);

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  AdminClient *client = this;

  // Queue the work.
  Napi::AsyncWorker *worker = new Workers::AdminClientDeleteGroups(
      callback, client, group_list, group_names_vector.size(), timeout_ms);
  worker->Queue();
  return env.Null();
}

/**
 * List Consumer Group Offsets.
 */
Napi::Value AdminClient::NodeListConsumerGroupOffsets(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Must provide an array of 'listGroupOffsets'").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array listGroupOffsets = info[0].As<Napi::Array>();

  if (listGroupOffsets.Length() == 0) {
    Napi::Error::New(env, "'listGroupOffsets' cannot be empty").ThrowAsJavaScriptException();
    return env.Null();
  }

  /**
   * The ownership of this is taken by
   * Workers::AdminClientListConsumerGroupOffsets and freeing it is also handled
   * by that class.
   */
  rd_kafka_ListConsumerGroupOffsets_t **requests =
      static_cast<rd_kafka_ListConsumerGroupOffsets_t **>(
          malloc(sizeof(rd_kafka_ListConsumerGroupOffsets_t *) *
                 listGroupOffsets.Length()));

  for (uint32_t i = 0; i < listGroupOffsets.Length(); ++i) {
    Napi::Value listGroupOffsetValue =
        (listGroupOffsets).Get(i);
    if (!listGroupOffsetValue.IsObject()) {
      Napi::Error::New(env, "Each entry must be an object").ThrowAsJavaScriptException();
      return env.Null();
    }
    Napi::Object listGroupOffsetObj =
        listGroupOffsetValue.As<Napi::Object>();

    Napi::Value groupIdValue;
    if (!(listGroupOffsetObj).Has(Napi::String::New(env, "groupId"))) {
      Napi::Error::New(env, "Each entry must have 'groupId'").ThrowAsJavaScriptException();
      return env.Null();
    } else {
      groupIdValue = listGroupOffsetObj.Get(Napi::String::New(env, "groupId"));
    }

    std::string groupIdStr = groupIdValue.ToString().Utf8Value();

    rd_kafka_topic_partition_list_t *partitions = NULL;

    Napi::MaybeOrValue<Napi::Value> partitionsValue =
        listGroupOffsetObj.Get(Napi::String::New(env, "partitions"));

    
    if (partitionsValue.IsArray()) {
      Napi::Array partitionsArray = partitionsValue.As<Napi::Array>();

      if (partitionsArray.Length() > 0) {
        partitions = Conversion::TopicPartition::
            TopicPartitionv8ArrayToTopicPartitionList(partitionsArray, false);
        if (partitions == NULL) {
          return ThrowError(env,
              "Failed to convert partitions to list, provide proper object in "
              "partitions");
        }
      }
    }

    requests[i] =
        rd_kafka_ListConsumerGroupOffsets_new(groupIdStr.c_str(), partitions);

    if (partitions != NULL) {
      rd_kafka_topic_partition_list_destroy(partitions);
    }
  }

  // Now process the second argument: options (timeout and requireStableOffsets)
  Napi::Object options = info[1].As<Napi::Object>();

  bool require_stable_offsets =
      GetParameter<bool>(options, "requireStableOffsets", false);
  int timeout_ms = GetParameter<int64_t>(options, "timeout", 5000);

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  AdminClient *client = this;

  // Queue the worker to process the offset fetch request asynchronously
  Napi::AsyncWorker *worker = new Workers::AdminClientListConsumerGroupOffsets(
      callback, client, requests, listGroupOffsets.Length(),
      require_stable_offsets, timeout_ms);
  worker->Queue();
  return env.Null();
}

/**
 * Delete Records.
 */
Napi::Value AdminClient::NodeDeleteRecords(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    return ThrowError(env,
        "Must provide array containg 'TopicPartitionOffset' objects");
  }

  if (!info[1].IsObject()) {
    Napi::Error::New(env, "Must provide 'options' object").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Get list of TopicPartitions to delete records from
  // and convert it into rd_kafka_DeleteRecords_t array
  Napi::Array delete_records_list = info[0].As<Napi::Array>();

  if (delete_records_list.Length() == 0) {
    Napi::Error::New(env, "Must provide at least one TopicPartitionOffset").ThrowAsJavaScriptException();
    return env.Null();
  }

  /**
   * The ownership of this is taken by
   * Workers::AdminClientDeleteRecords and freeing it is also handled
   * by that class.
   */
  rd_kafka_DeleteRecords_t **delete_records =
      static_cast<rd_kafka_DeleteRecords_t **>(
          malloc(sizeof(rd_kafka_DeleteRecords_t *) * 1));

  rd_kafka_topic_partition_list_t *partitions =
      Conversion::TopicPartition::TopicPartitionv8ArrayToTopicPartitionList(
          delete_records_list, true);
  if (partitions == NULL) {
    return ThrowError(env,
        "Failed to convert objects in delete records list, provide proper "
        "TopicPartitionOffset objects");
  }
  delete_records[0] = rd_kafka_DeleteRecords_new(partitions);

  rd_kafka_topic_partition_list_destroy(partitions);

  // Now process the second argument: options (timeout and operation_timeout)
  Napi::Object options = info[1].As<Napi::Object>();

  int operation_timeout_ms =
      GetParameter<int64_t>(options, "operation_timeout", 60000);
  int timeout_ms = GetParameter<int64_t>(options, "timeout", 5000);

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);

  AdminClient *client = this;

  // Queue the worker to process the offset fetch request asynchronously
  Napi::AsyncWorker *worker = new Workers::AdminClientDeleteRecords(
      callback, client, delete_records, 1, operation_timeout_ms, timeout_ms);

  worker->Queue();
  return env.Null();
}

/**
 * Describe Topics.
 */
Napi::Value AdminClient::NodeDescribeTopics(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Must provide an array of 'topicNames'").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array topicNames = info[0].As<Napi::Array>();

  if (topicNames.Length() == 0) {
    Napi::Error::New(env, "'topicNames' cannot be empty").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::vector<std::string> topicNamesVector = v8ArrayToStringVector(topicNames);

  const char **topics = static_cast<const char **>(
      malloc(sizeof(const char *) * topicNamesVector.size()));

  for (size_t i = 0; i < topicNamesVector.size(); i++) {
    topics[i] = topicNamesVector[i].c_str();
  }

  /**
   * The ownership of this is taken by
   * Workers::AdminClientDescribeTopics and freeing it is also handled
   * by that class.
   */
  rd_kafka_TopicCollection_t *topic_collection =
      rd_kafka_TopicCollection_of_topic_names(topics, topicNamesVector.size());

  free(topics);

  Napi::Object options = info[1].As<Napi::Object>();

  bool include_authorised_operations =
      GetParameter<bool>(options, "includeAuthorizedOperations", false);

  int timeout_ms = GetParameter<int64_t>(options, "timeout", 5000);

  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  AdminClient *client = this;

  Napi::AsyncWorker *worker = new Workers::AdminClientDescribeTopics(
      callback, client, topic_collection, include_authorised_operations,
      timeout_ms);
  worker->Queue();
  
  return env.Null();
}


/**
 * List Offsets.
 */
Napi::Value AdminClient::NodeListOffsets(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  Napi::HandleScope scope(env);

  if (info.Length() < 3 || !info[2].IsFunction()) {
    Napi::Error::New(env, "Need to specify a callback").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsArray()) {
    Napi::Error::New(env, "Must provide an array of 'TopicPartitionOffsets'").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array listOffsets = info[0].As<Napi::Array>();

  /**
   * The ownership of this is taken by
   * Workers::AdminClientListOffsets and freeing it is also handled
   * by that class.
   */
  rd_kafka_topic_partition_list_t *partitions = Conversion::TopicPartition::
      TopicPartitionOffsetSpecv8ArrayToTopicPartitionList(listOffsets);

  // Now process the second argument: options (timeout and isolationLevel)
  Napi::Object options = info[1].As<Napi::Object>();

  rd_kafka_IsolationLevel_t isolation_level =
      static_cast<rd_kafka_IsolationLevel_t>(GetParameter<int32_t>(
          options, "isolationLevel",
          static_cast<int32_t>(RD_KAFKA_ISOLATION_LEVEL_READ_UNCOMMITTED)));

  int timeout_ms = GetParameter<int64_t>(options, "timeout", 5000);

  // Create the final callback object
  Napi::Function cb = info[2].As<Napi::Function>();
  Napi::FunctionReference *callback = new Napi::FunctionReference();
  callback->Reset(cb);
  AdminClient *client = this;

  // Queue the worker to process the offset fetch request asynchronously
  Napi::AsyncWorker *worker = new Workers::AdminClientListOffsets(
      callback, client, partitions, timeout_ms, isolation_level);
  worker->Queue();
  return env.Null();
}

}  // namespace NodeKafka
