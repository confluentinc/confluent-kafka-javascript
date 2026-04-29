/*
 * confluent-kafka-javascript - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2026 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE.txt file for details.
 */

var t = require('assert');
var Module = require('module');

var dispatcher = require('../lib/auto-wire-aws.js');
var Producer = require('../lib/producer');
var applyAwsOAuthBearerAutowire = dispatcher.applyAwsOAuthBearerAutowire;
var MARKER_KEY = dispatcher._MARKER_KEY;
var MARKER_VALUE = dispatcher._MARKER_VALUE;
var METHOD_KEY = dispatcher._METHOD_KEY;
var CALLBACK_KEY = dispatcher._CALLBACK_KEY;
var PKG_NAME = dispatcher._PKG_NAME;

// ────────────────────────────────────────────────────────────────────────
// Helpers for mocking `require()` of the optional package via Module._load.
// We restore the original after each test so tests don't pollute each other.
// ────────────────────────────────────────────────────────────────────────

var realLoad = Module._load;

/** Replace Module._load so requesting `request` throws MODULE_NOT_FOUND. */
function stubLoadMissing(request) {
  Module._load = function (req) {
    if (req === request) {
      var e = new Error("Cannot find module '" + req + "'");
      e.code = 'MODULE_NOT_FOUND';
      throw e;
    }
    return realLoad.apply(this, arguments);
  };
}

/** Replace Module._load so requesting `request` returns `stub`. */
function stubLoadReturn(request, stub) {
  Module._load = function (req) {
    if (req === request) return stub;
    return realLoad.apply(this, arguments);
  };
}

/** Replace Module._load with a counter; useful for "no require call" tests. */
function makeLoadCounter() {
  var counter = { calls: 0 };
  Module._load = function (req) {
    if (req === PKG_NAME) counter.calls += 1;
    return realLoad.apply(this, arguments);
  };
  return counter;
}

function restoreLoad() {
  Module._load = realLoad;
}

module.exports = {
  'AWS IAM OAUTHBEARER autowire dispatcher (lib/auto-wire-aws.js)': {

    'afterEach': function () {
      restoreLoad();
      dispatcher._resetCacheForTesting();
    },

    'no-op cases': {

      'returns silently when globalConf is null': function () {
        t.doesNotThrow(function () {
          applyAwsOAuthBearerAutowire(null);
        });
      },

      'returns silently when globalConf is undefined': function () {
        t.doesNotThrow(function () {
          applyAwsOAuthBearerAutowire(undefined);
        });
      },

      'returns silently when globalConf is a primitive': function () {
        t.doesNotThrow(function () {
          applyAwsOAuthBearerAutowire('not-an-object');
        });
      },

      'no-op when marker is absent (does not require the optional pkg)': function () {
        var counter = makeLoadCounter();
        var cfg = { 'metadata.broker.list': 'localhost:9092' };
        applyAwsOAuthBearerAutowire(cfg);
        t.deepStrictEqual(cfg, { 'metadata.broker.list': 'localhost:9092' },
          'globalConf must be untouched when marker is absent');
        t.strictEqual(counter.calls, 0,
          'must not require(' + PKG_NAME + ') when marker is absent');
      },

      'no-op when marker has wrong value': function () {
        var counter = makeLoadCounter();
        var cfg = {};
        cfg[MARKER_KEY] = 'azure_imds';   // not aws_iam
        applyAwsOAuthBearerAutowire(cfg);
        t.strictEqual(cfg[MARKER_KEY], 'azure_imds',
          'unrelated marker values must pass through unchanged');
        t.strictEqual(counter.calls, 0,
          'must not require optional pkg for unrelated marker values');
      },
    },

    'precedence rule (explicit handler wins)': {

      'leaves explicit oauthbearer_token_refresh_cb untouched and strips marker':
        function () {
          var counter = makeLoadCounter();
          var explicitFn = function () { /* user-supplied */ };
          var cfg = {};
          cfg[MARKER_KEY] = MARKER_VALUE;
          cfg[CALLBACK_KEY] = explicitFn;

          applyAwsOAuthBearerAutowire(cfg);

          t.strictEqual(cfg[CALLBACK_KEY], explicitFn,
            'explicit handler must remain untouched (precedence rule)');
          t.ok(!(MARKER_KEY in cfg),
            'marker must be stripped even when explicit handler wins');
          t.strictEqual(counter.calls, 0,
            'optional pkg must not be loaded when explicit handler wins');
        },
    },

    'method=oidc + marker rejection': {

      'throws ERR_OAUTHBEARER_AWS_METHOD_OIDC with a clear message': function () {
        var cfg = {};
        cfg[MARKER_KEY] = MARKER_VALUE;
        cfg[METHOD_KEY] = 'oidc';
        cfg['sasl.oauthbearer.config'] = 'region=x audience=y';

        t.throws(
          function () { applyAwsOAuthBearerAutowire(cfg); },
          function (err) {
            t.strictEqual(err.code, 'ERR_OAUTHBEARER_AWS_METHOD_OIDC');
            t.ok(/incompatible with .*=oidc/.test(err.message),
              'message must mention the conflict: ' + err.message);
            return true;
          }
        );
      },
    },

    'package missing': {

      'throws ERR_OAUTHBEARER_AWS_MISSING with install instruction': function () {
        stubLoadMissing(PKG_NAME);
        var cfg = {};
        cfg[MARKER_KEY] = MARKER_VALUE;
        cfg['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';

        t.throws(
          function () { applyAwsOAuthBearerAutowire(cfg); },
          function (err) {
            t.strictEqual(err.code, 'ERR_OAUTHBEARER_AWS_MISSING');
            t.ok(err.message.indexOf('npm install ' + PKG_NAME) >= 0,
              'message must include the install command');
            return true;
          }
        );
      },

      'transitive MODULE_NOT_FOUND is NOT wrapped (different bug class)': function () {
        // Simulate: user installed our pkg, but one of its transitive deps
        // (e.g. @aws-sdk/client-sts) is missing. Our friendly-error code path
        // must NOT swallow this — it's a broken install, not a missing one.
        Module._load = function (req) {
          if (req === PKG_NAME) {
            var e = new Error("Cannot find module '@aws-sdk/client-sts'");
            e.code = 'MODULE_NOT_FOUND';
            throw e;
          }
          return realLoad.apply(this, arguments);
        };
        var cfg = {};
        cfg[MARKER_KEY] = MARKER_VALUE;
        cfg['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';

        t.throws(
          function () { applyAwsOAuthBearerAutowire(cfg); },
          function (err) {
            t.notStrictEqual(err.code, 'ERR_OAUTHBEARER_AWS_MISSING',
              'transitive miss must NOT be wrapped as ERR_OAUTHBEARER_AWS_MISSING');
            t.ok(err.message.indexOf('@aws-sdk/client-sts') >= 0,
              'transitive miss must surface the actual missing module name');
            return true;
          }
        );
      },
    },

    'package present but stale': {

      'throws "upgrade" error when awsAutoWire export is missing': function () {
        // Simulate a broken/old version of the optional pkg that doesn't
        // export awsAutoWire.
        stubLoadReturn(PKG_NAME, { /* no awsAutoWire here */ });
        var cfg = {};
        cfg[MARKER_KEY] = MARKER_VALUE;
        cfg['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';

        t.throws(
          function () { applyAwsOAuthBearerAutowire(cfg); },
          /does not export 'awsAutoWire.createHandler'.*Upgrade/
        );
      },

      'throws "upgrade" error when createHandler is missing from awsAutoWire':
        function () {
          stubLoadReturn(PKG_NAME, { awsAutoWire: { /* no createHandler */ } });
          var cfg = {};
          cfg[MARKER_KEY] = MARKER_VALUE;
          cfg['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';

          t.throws(
            function () { applyAwsOAuthBearerAutowire(cfg); },
            /does not export 'awsAutoWire.createHandler'/
          );
        },
    },

    'cache behavior': {

      'second invocation does not require the optional pkg again': function () {
        // First, stub require to return a fake awsAutoWire that we control.
        var fakeHandler = function () {};
        var createHandlerCalls = 0;
        stubLoadReturn(PKG_NAME, {
          awsAutoWire: {
            createHandler: function () {
              createHandlerCalls += 1;
              return fakeHandler;
            },
          },
        });

        var cfg1 = {};
        cfg1[MARKER_KEY] = MARKER_VALUE;
        cfg1['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';
        applyAwsOAuthBearerAutowire(cfg1);
        t.strictEqual(cfg1[CALLBACK_KEY], fakeHandler);

        // Now flip Module._load to count any further loads of PKG_NAME. If
        // the cache is working, the second invocation must not re-load.
        var counter = makeLoadCounter();

        var cfg2 = {};
        cfg2[MARKER_KEY] = MARKER_VALUE;
        cfg2['sasl.oauthbearer.config'] = 'region=eu-north-1 audience=https://y';
        applyAwsOAuthBearerAutowire(cfg2);
        t.strictEqual(cfg2[CALLBACK_KEY], fakeHandler);

        t.strictEqual(counter.calls, 0,
          'second applyAwsOAuthBearerAutowire must not require(' + PKG_NAME + ') again');
        t.strictEqual(createHandlerCalls, 2,
          'createHandler MUST be called once per applyAwsOAuthBearerAutowire ' +
          '(provider state per client)');
      },
    },

    'happy path with stubbed awsAutoWire': {

      'installs the returned handler under oauthbearer_token_refresh_cb and strips marker':
        function () {
          var fakeHandler = async function (s) { return { tokenValue: 'jwt-' + s }; };
          stubLoadReturn(PKG_NAME, {
            awsAutoWire: {
              createHandler: function (kafkaConfig) {
                t.ok(kafkaConfig['sasl.oauthbearer.config'],
                  'createHandler must receive the full globalConf, including ' +
                  'sasl.oauthbearer.config');
                return fakeHandler;
              },
            },
          });
          var cfg = {};
          cfg[MARKER_KEY] = MARKER_VALUE;
          cfg['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';

          applyAwsOAuthBearerAutowire(cfg);

          t.strictEqual(cfg[CALLBACK_KEY], fakeHandler,
            'autowired handler must be installed under oauthbearer_token_refresh_cb');
          t.ok(!(MARKER_KEY in cfg),
            'marker must be stripped after installing the handler');
          t.strictEqual(cfg['sasl.oauthbearer.config'],
            'region=us-east-1 audience=https://x',
            'sasl.oauthbearer.config must be preserved (librdkafka forwards it ' +
            'verbatim to the refresh handler)');
        },
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // End-to-end wiring through lib/client.js. Constructs a real Kafka.Producer
  // with the marker config and verifies the autowired callback ends up in
  // _cb_configs.global.oauthbearer_token_refresh_cb (the L135 wrapper sees
  // it just like a user-supplied callback).
  //
  // We DO NOT invoke the wrapped callback end-to-end here — that would call
  // the native binding's setOAuthBearerToken, which is unrelated wiring.
  // The wrapper itself is pre-existing core code we didn't touch.
  // ────────────────────────────────────────────────────────────────────────
  'AWS IAM OAUTHBEARER autowire — end-to-end wiring through Kafka.Producer': {

    'afterEach': function () {
      restoreLoad();
      dispatcher._resetCacheForTesting();
    },

    'marker config triggers autowire and installs callback into _cb_configs': function () {
      var fakeHandler = async function () { return { tokenValue: 'jwt' }; };
      stubLoadReturn(PKG_NAME, {
        awsAutoWire: {
          createHandler: function () { return fakeHandler; },
        },
      });

      var producerCfg = {
        'metadata.broker.list': 'localhost:9092',
        'security.protocol':    'SASL_SSL',
        'sasl.mechanisms':      'OAUTHBEARER',
        'socket.timeout.ms':    250,
      };
      producerCfg[MARKER_KEY] = MARKER_VALUE;
      producerCfg['sasl.oauthbearer.config'] = 'region=us-east-1 audience=https://x';

      var producer = new Producer(producerCfg, {});

      t.strictEqual(typeof producer._cb_configs.global[CALLBACK_KEY], 'function',
        'autowired callback must be installed in _cb_configs.global');
      t.ok(!(MARKER_KEY in producer.globalConfig),
        'marker must be stripped from the cloned globalConfig');
    },

    'absent marker leaves Producer construction unchanged (no require call)': function () {
      var counter = makeLoadCounter();

      var producer = new Producer({
        'metadata.broker.list': 'localhost:9092',
        'socket.timeout.ms':    250,
      }, {});

      t.strictEqual(counter.calls, 0,
        'must not require optional pkg when marker is absent');
      t.ok(producer._cb_configs.global[CALLBACK_KEY] === undefined,
        'no oauthbearer_token_refresh_cb installed when marker is absent');
    },
  },
};
