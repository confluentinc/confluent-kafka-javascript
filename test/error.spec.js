/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var LibrdKafkaError = require('../lib/error');
var t = require('assert');

module.exports = {
  'LibrdKafkaError': {
    'has a local origin for a local error code': function () {
      t.strictEqual(LibrdKafkaError.create(LibrdKafkaError.codes.ERR__FENCED).origin, 'local');
      t.strictEqual(LibrdKafkaError.create({
        code: LibrdKafkaError.codes.ERR__FENCED,
        message: 'Local: This instance has been fenced by a newer instance',
      }).origin, 'local');
    },
    'has a kafka origin for a broker error code': function () {
      t.strictEqual(LibrdKafkaError.create(LibrdKafkaError.codes.ERR_NOT_COORDINATOR).origin, 'kafka');
      t.strictEqual(LibrdKafkaError.create({
        code: LibrdKafkaError.codes.ERR_NOT_COORDINATOR,
        message: 'Broker: Not coordinator',
      }).origin, 'kafka');
    },
  },
};
