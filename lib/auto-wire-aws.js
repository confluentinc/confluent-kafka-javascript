/*
 * confluent-kafka-javascript - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2026 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE.txt file for details.
 */

/**
 * AWS IAM OAUTHBEARER autowire dispatcher.
 *
 * Hybrid Path A — when the user sets:
 *   sasl.oauthbearer.metadata.authentication.type = 'aws_iam'
 *   sasl.oauthbearer.config = 'region=… audience=…'
 *
 * this module lazily requires `@confluentinc/kafka-javascript-oauthbearer-aws`,
 * invokes its frozen `awsAutoWire.createHandler(globalConf)` contract, and
 * installs the returned async function as `oauthbearer_token_refresh_cb`.
 * The marker key is then deleted from globalConf so librdkafka does not see
 * the (currently unrecognised) value.
 *
 * The optional package is NEVER loaded unless the marker is present, which
 * preserves the dep-graph invariant: `npm install @confluentinc/kafka-javascript`
 * by itself produces zero `@aws-sdk/*` directories in `node_modules`.
 */

'use strict';

const Module = require('module');

const MARKER_KEY    = 'sasl.oauthbearer.metadata.authentication.type';
const MARKER_VALUE  = 'aws_iam';
const METHOD_KEY    = 'sasl.oauthbearer.method';
const CALLBACK_KEY  = 'oauthbearer_token_refresh_cb';
const PKG_NAME      = '@confluentinc/kafka-javascript-oauthbearer-aws';

/**
 * Module-scoped cache of the resolved `awsAutoWire` namespace. One resolution
 * per process. Cleared in tests via `_resetCacheForTesting`.
 */
let _cachedAwsAutoWire = null;

/**
 * Discriminates a `MODULE_NOT_FOUND` originating from our package itself
 * (which means the user hasn't installed it) from a `MODULE_NOT_FOUND` thrown
 * by a transitive of our package (which means the install is broken — a
 * different bug class). The Node convention is to inspect the missing-module
 * name in the message: `Cannot find module '<name>'`.
 */
function isMissingTopLevelPkg(err) {
  return err
    && err.code === 'MODULE_NOT_FOUND'
    && typeof err.message === 'string'
    && err.message.startsWith(`Cannot find module '${PKG_NAME}'`);
}

/**
 * Lazy + cached resolution of `awsAutoWire`. Throws friendly errors on the
 * two failure modes:
 *   - package not installed → ERR_OAUTHBEARER_AWS_MISSING with install hint
 *   - package installed but stale → "Upgrade to a compatible version"
 */
function resolveAwsAutoWire() {
  if (_cachedAwsAutoWire !== null) return _cachedAwsAutoWire;

  let pkg;
  try {
    pkg = require(PKG_NAME);
  } catch (err) {
    if (isMissingTopLevelPkg(err)) {
      const friendly = new Error(
        `Config '${MARKER_KEY}=${MARKER_VALUE}' requires the ${PKG_NAME} package. ` +
        `Install it with:\n` +
        `    npm install ${PKG_NAME}\n` +
        `Original error: ${err.message}`,
      );
      friendly.code = 'ERR_OAUTHBEARER_AWS_MISSING';
      throw friendly;
    }
    // Transitive MODULE_NOT_FOUND or any other error: re-throw unchanged so
    // the user sees the actual broken-install diagnostic.
    throw err;
  }

  if (!pkg || typeof pkg !== 'object'
      || !pkg.awsAutoWire
      || typeof pkg.awsAutoWire.createHandler !== 'function') {
    throw new Error(
      `${PKG_NAME} is installed but does not export 'awsAutoWire.createHandler'. ` +
      `Upgrade to a version compatible with this @confluentinc/kafka-javascript build.`,
    );
  }

  _cachedAwsAutoWire = pkg.awsAutoWire;
  return _cachedAwsAutoWire;
}

/**
 * Inspects globalConf for the AWS IAM marker and, if present, mutates the
 * config to install the autowired refresh callback. Idempotent. Safe no-op
 * when the marker is absent (which is the path for >99% of all clients).
 *
 * MUST be called BEFORE the native client constructor (`new SubClientType(
 * globalConf, ...)`) so librdkafka does not see the marker key. After this
 * call returns:
 *   - if the marker was set:
 *       - the marker key is deleted from globalConf
 *       - if no explicit `oauthbearer_token_refresh_cb` was set, the
 *         autowired function is installed there
 *       - if an explicit handler was already present, it wins (precedence
 *         rule); the marker is silently dropped
 *   - if the marker was absent:
 *       - globalConf is unchanged; no `require` of the optional pkg occurs
 *
 * @param {Object} globalConf  The user's mutable config object. Must be
 *   passed before native handoff.
 *
 * @throws Error with code 'ERR_OAUTHBEARER_AWS_METHOD_OIDC' if the user
 *   combined the AWS marker with `sasl.oauthbearer.method=oidc`. That
 *   combination is a librdkafka-side trap (the OIDC path takes over and
 *   never invokes the refresh handler) — reject loudly.
 *
 * @throws Error with code 'ERR_OAUTHBEARER_AWS_MISSING' if the marker is
 *   set but the optional pkg is not installed.
 *
 * @throws Whatever `awsAutoWire.createHandler` throws on grammar /
 *   validation failures (TypeError with a clear message naming the
 *   offending field).
 */
function applyAwsOAuthBearerAutowire(globalConf) {
  if (!globalConf || typeof globalConf !== 'object') return;

  const marker = globalConf[MARKER_KEY];
  if (marker !== MARKER_VALUE) return;

  // Precedence: explicit user-supplied handler wins over autowire. We still
  // strip the marker key (librdkafka would reject it) but leave the user's
  // handler untouched. Documented in the package README's precedence note.
  if (typeof globalConf[CALLBACK_KEY] === 'function') {
    delete globalConf[MARKER_KEY];
    return;
  }

  // method=oidc + marker is a librdkafka-side user-trap: rdkafka_conf.c's
  // OIDC config-finalize path takes over and never invokes our refresh
  // handler. Reject at construction with a clear message.
  if (globalConf[METHOD_KEY] === 'oidc') {
    const e = new Error(
      `${MARKER_KEY}=${MARKER_VALUE} is incompatible with ${METHOD_KEY}=oidc. ` +
      `Remove ${METHOD_KEY} (or set it to its default) to use the AWS path.`,
    );
    e.code = 'ERR_OAUTHBEARER_AWS_METHOD_OIDC';
    throw e;
  }

  const awsAutoWire = resolveAwsAutoWire();
  const handler = awsAutoWire.createHandler(globalConf);

  globalConf[CALLBACK_KEY] = handler;
  delete globalConf[MARKER_KEY];
}

module.exports = {
  applyAwsOAuthBearerAutowire,

  // Test-only exports. Not part of any documented public surface; subject
  // to change without notice.
  _MARKER_KEY: MARKER_KEY,
  _MARKER_VALUE: MARKER_VALUE,
  _METHOD_KEY: METHOD_KEY,
  _CALLBACK_KEY: CALLBACK_KEY,
  _PKG_NAME: PKG_NAME,
  _resetCacheForTesting() { _cachedAwsAutoWire = null; },
  _Module: Module,   // tests monkey-patch Module._load via this re-export
};
