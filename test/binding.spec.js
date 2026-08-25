/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var addon = require('bindings')('confluent-kafka-javascript');
var t = require('assert');

var consumerConfig = {
  'group.id': 'awesome'
};

var producerConfig = {
  'client.id': 'kafka-mocha',
  'metadata.broker.list': 'localhost:9092',
  'socket.timeout.ms': 250
};

var client;

module.exports = {
  'native addon': {
    'exports something': function() {
      t.equal(typeof(addon), 'object');
    },
    'exports valid producer': function() {
      t.equal(typeof(addon.Producer), 'function');
      t.throws(addon.Producer); // Requires constructor
      t.equal(typeof(new addon.Producer({}, {})), 'object');
    },
    'exports valid consumer': function() {
      t.equal(typeof(addon.KafkaConsumer), 'function');
      t.throws(addon.KafkaConsumer); // Requires constructor
      var consumer = new addon.KafkaConsumer(consumerConfig, {});
      t.equal(typeof(consumer), 'object');
      t.throws(function() {
        consumer.assign([1]);
      }, /Must pass topic-partition objects/);
    },
    'exports version': function() {
      t.ok(addon.librdkafkaVersion);
    },
    'exports builtin features repeatedly': function() {
      for (var i = 0; i < 100; i++) {
        t.equal(typeof(addon.features()), 'string');
      }
    },
    'rejects invalid Topic construction': function() {
      t.throws(function() {
        return new addon.Topic();
      }, /topic name is required/);
    },
    'Producer client': {
      'beforeEach': function() {
        client = new addon.Producer(producerConfig, {});
      },
      'afterEach': function() {
        client = null;
      },
      'is an object': function() {
        t.equal(typeof(client), 'object');
      },
      'requires configuration': function() {
        t.throws(function() {
          return new addon.Producer();
        });
      },
      'has necessary methods from superclass': function() {
        var methods = ['connect', 'disconnect', 'configureCallbacks', 'getMetadata'];
        methods.forEach(function(m) {
          t.equal(typeof(client[m]), 'function', 'Client is missing ' + m + ' method');
        });
      }
    }
  },
};
