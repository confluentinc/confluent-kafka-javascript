/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
#include "src/config.h"

#include <iostream>
#include <string>
#include <vector>
#include <list>

using Napi::MaybeLocal;
using Napi::Maybe;
using Napi::String;
using Napi::Object;
using std::cout;
using std::endl;

namespace NodeKafka {

void Conf::DumpConfig(std::list<std::string> *dump) {
  for (std::list<std::string>::iterator it = dump->begin();
         it != dump->end(); ) {
    std::cout << *it << " = ";
    it++;
    std::cout << *it << std::endl;
    it++;
  }
  std::cout << std::endl;
}

Conf * Conf::create(RdKafka::Conf::ConfType type, Napi::Object object, std::string &errstr) {  // NOLINT
  v8::Local<v8::Context> context = Napi::GetCurrentContext();
  Conf* rdconf = static_cast<Conf*>(RdKafka::Conf::create(type));

  v8::MaybeLocal<v8::Array> _property_names = object->GetOwnPropertyNames(
    Napi::GetCurrentContext());
  Napi::Array property_names = _property_names;

  for (unsigned int i = 0; i < property_names->Length(); ++i) {
    std::string string_value;
    std::string string_key;

    Napi::Value key = (property_names).Get(i);
    Napi::Value value = (object).Get(key);

    if (key.IsString()) {
      std::string utf8_key = key.As<Napi::String>();
      string_key = std::string(*utf8_key);
    } else {
      continue;
    }

    if (!value->IsFunction()) {
#if NODE_MAJOR_VERSION > 6
      if (value.IsNumber()) {
        string_value = std::to_string(
          value->Int32Value(context).ToChecked());
      } else if (value->IsUint32()) {
        string_value = std::to_string(
          value->Uint32Value(context).ToChecked());
      } else if (value->IsBoolean()) {
        const bool v = value.As<Napi::Boolean>().Value().ToChecked();
        string_value = v ? "true" : "false";
      } else {
        std::string utf8_value = value.As<v8::String>(.As<Napi::String>());
        string_value = std::string(*utf8_value);
      }
#else
      std::string utf8_value = value.As<v8::String>(.As<Napi::String>());
      string_value = std::string(*utf8_value);
#endif
      if (rdconf->set(string_key, string_value, errstr)
        != Conf::CONF_OK) {
          delete rdconf;
          return NULL;
      }
    } else {
     // Do nothing - NodeConfigureCallbacks will handle this for each
     // of the three client types, called from within JavaScript.
    }
  }

  return rdconf;
}

void Conf::ConfigureCallback(
  const std::string &string_key,
  const Napi::Function &cb,
  bool add, std::string &errstr) {
  if (string_key.compare("rebalance_cb") == 0) {
    NodeKafka::Callbacks::Rebalance *rebalance = rebalance_cb();
    if (add) {
      if (rebalance == NULL) {
        rebalance = new NodeKafka::Callbacks::Rebalance();
        this->set(string_key, rebalance, errstr);
      }
      rebalance->dispatcher.AddCallback(cb);
      this->set(string_key, rebalance, errstr);
    } else {
      if (rebalance == NULL) {
        rebalance->dispatcher.RemoveCallback(cb);
        this->set(string_key, rebalance, errstr);
      }
    }
  } else if (string_key.compare("offset_commit_cb") == 0) {
    NodeKafka::Callbacks::OffsetCommit *offset_commit = offset_commit_cb();
    if (add) {
      if (offset_commit == NULL) {
        offset_commit = new NodeKafka::Callbacks::OffsetCommit();
        this->set(string_key, offset_commit, errstr);
      }
      offset_commit->dispatcher.AddCallback(cb);
    } else {
      if (offset_commit != NULL) {
        offset_commit->dispatcher.RemoveCallback(cb);
      }
    }
  } else if (string_key.compare("oauthbearer_token_refresh_cb") == 0) {
    NodeKafka::Callbacks::OAuthBearerTokenRefresh *oauthbearer_token_refresh =
        oauthbearer_token_refresh_cb();
    if (add) {
      if (oauthbearer_token_refresh == NULL) {
        oauthbearer_token_refresh =
            new NodeKafka::Callbacks::OAuthBearerTokenRefresh();
        this->set(string_key, oauthbearer_token_refresh, errstr);
      }
      oauthbearer_token_refresh->dispatcher.AddCallback(cb);
    } else {
      if (oauthbearer_token_refresh != NULL) {
        oauthbearer_token_refresh->dispatcher.RemoveCallback(cb);
      }
    }
  } else {
    errstr = "Invalid callback type";
  }
}

void Conf::listen() {
  NodeKafka::Callbacks::Rebalance *rebalance = rebalance_cb();
  if (rebalance) {
    rebalance->dispatcher.Activate();
  }

  NodeKafka::Callbacks::OffsetCommit *offset_commit = offset_commit_cb();
  if (offset_commit) {
    offset_commit->dispatcher.Activate();
  }

  NodeKafka::Callbacks::OAuthBearerTokenRefresh *oauthbearer_token_refresh =
      oauthbearer_token_refresh_cb();
  if (oauthbearer_token_refresh) {
    oauthbearer_token_refresh->dispatcher.Activate();
  }
}

void Conf::stop() {
  NodeKafka::Callbacks::Rebalance *rebalance = rebalance_cb();
  if (rebalance) {
    rebalance->dispatcher.Deactivate();
  }

  NodeKafka::Callbacks::OffsetCommit *offset_commit = offset_commit_cb();
  if (offset_commit) {
    offset_commit->dispatcher.Deactivate();
  }

  NodeKafka::Callbacks::OAuthBearerTokenRefresh *oauthbearer_token_refresh =
      oauthbearer_token_refresh_cb();
  if (oauthbearer_token_refresh) {
    oauthbearer_token_refresh->dispatcher.Deactivate();
  }
}

Conf::~Conf() {
  // Delete the rdconf object, since that's what we are internally.
  RdKafka::Conf *rdconf = static_cast<RdKafka::Conf*>(this);
  delete rdconf;
}

NodeKafka::Callbacks::Rebalance* Conf::rebalance_cb() const {
  RdKafka::RebalanceCb *cb = NULL;
  if (this->get(cb) != RdKafka::Conf::CONF_OK) {
    return NULL;
  }
  return static_cast<NodeKafka::Callbacks::Rebalance*>(cb);
}

NodeKafka::Callbacks::OffsetCommit* Conf::offset_commit_cb() const {
  RdKafka::OffsetCommitCb *cb = NULL;
  if (this->get(cb) != RdKafka::Conf::CONF_OK) {
    return NULL;
  }
  return static_cast<NodeKafka::Callbacks::OffsetCommit*>(cb);
}

NodeKafka::Callbacks::OAuthBearerTokenRefresh *
Conf::oauthbearer_token_refresh_cb() const {
  RdKafka::OAuthBearerTokenRefreshCb *cb = NULL;
  if (this->get(cb) != RdKafka::Conf::CONF_OK) {
    return NULL;
  }
  return static_cast<NodeKafka::Callbacks::OAuthBearerTokenRefresh *>(cb);
}

bool Conf::is_sasl_oauthbearer() const {
  std::string sasl_mechanism;
  if (this->get("sasl.mechanisms", sasl_mechanism) != RdKafka::Conf::CONF_OK) {
    return false;
  }
  return sasl_mechanism.compare("OAUTHBEARER") == 0;
}

}  // namespace NodeKafka
