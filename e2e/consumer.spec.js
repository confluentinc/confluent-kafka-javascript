/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var t = require('assert');
var crypto = require('crypto');

var eventListener = require('./listener');
const { createTopics, deleteTopics } = require('./topicUtils');

var KafkaConsumer = require('../').KafkaConsumer;

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

describe('Consumer', function() {
  var gcfg;
  let topic;
  let createdTopics = [];

  beforeEach(function(done) {
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');
    topic = 'test' + crypto.randomBytes(20).toString('hex');
     gcfg = {
      'bootstrap.servers': kafkaBrokerList,
      'group.id': grp,
      'debug': 'all',
      'rebalance_cb': true,
      'enable.auto.commit': false
    };
    createTopics([{topic, num_partitions: 1, replication_factor: 1}], kafkaBrokerList, done);
    createdTopics.push(topic);
  });

  after(function(done) {
    deleteTopics(createdTopics, kafkaBrokerList, done);
  });

  describe('commit', function() {
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    it('should allow commit with an array', function(done) {
      consumer.commit([{ topic: topic, partition: 0, offset: -1 }]);
      done();
    });

    it('should allow commit without an array', function(done) {
      consumer.commit({ topic: topic, partition: 0, offset: -1 });
      done();
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });
  });

  describe('committed and position', function() {
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('before assign, committed offsets are empty', function(done) {
      consumer.committed(null, 1000, function(err, committed) {
        t.ifError(err);
        t.equal(Array.isArray(committed), true, 'Committed offsets should be an array');
        t.equal(committed.length, 0);
        done();
      });
    });

    it('before assign, position returns an empty array', function() {
      var position = consumer.position();
      t.equal(Array.isArray(position), true, 'Position should be an array');
      t.equal(position.length, 0);
    });

    it('after assign, should get committed array without offsets ', function (done) {
      consumer.assign([{ topic: topic, partition: 0 }]);
      consumer.committed(null, 1000, function (err, committed) {
        t.ifError(err);
        t.equal(committed.length, 1);
        t.equal(typeof committed[0], 'object', 'TopicPartition should be an object');
        t.deepStrictEqual(committed[0].partition, 0);
        t.equal(committed[0].offset, undefined);
        done();
      }, 1000);
    });

    it('after assign and commit, should get committed offsets with same metadata', function(done) {
      consumer.assign([{topic:topic, partition:0}]);
      consumer.commitSync({topic:topic, partition:0, offset:1000, metadata: 'A string with unicode ǂ'});
      consumer.committed(null, 1000, function(err, committed) {
        t.ifError(err);
        t.equal(committed.length, 1);
        t.equal(typeof committed[0], 'object', 'TopicPartition should be an object');
        t.deepStrictEqual(committed[0].partition, 0);
        t.deepStrictEqual(committed[0].offset, 1000);
        t.deepStrictEqual(committed[0].metadata, 'A string with unicode ǂ');
        done();
      });
    });

    it('after assign and commit, a different consumer should get the same committed offsets and metadata', function(done) {
      consumer.assign([{topic:topic, partition:0}]);
      consumer.commitSync({topic:topic, partition:0, offset:1000, metadata: 'A string with unicode ǂ'});

      let consumer2 = new KafkaConsumer(gcfg, {});
      consumer2.connect({ timeout: 2000 }, function (err, info) {
        consumer2.committed([{ topic, partition: 0 }], 1000, function (err, committed) {
          t.ifError(err);
          t.equal(committed.length, 1);
          t.equal(typeof committed[0], 'object', 'TopicPartition should be an object');
          t.deepStrictEqual(committed[0].partition, 0);
          t.deepStrictEqual(committed[0].offset, 1000);
          t.deepStrictEqual(committed[0].metadata, 'A string with unicode ǂ');
          consumer2.disconnect(done);
        });
      });
    });

    it('after assign, before consume, position should return an array without offsets', function(done) {
      consumer.assign([{topic:topic, partition:0}]);
      var position = consumer.position();
      t.equal(Array.isArray(position), true, 'Position should be an array');
      t.equal(position.length, 1);
      t.equal(typeof position[0], 'object', 'TopicPartition should be an object');
      t.deepStrictEqual(position[0].partition, 0);
      t.equal(position[0].offset, undefined, 'before consuming, offset is undefined');
      // see both.spec.js 'should be able to produce, consume messages, read position...'
      // for checking of offset numeric value
      done();
    });

    it('should obey the timeout', function(done) {
      consumer.committed(null, 0, function(err, committed) {
        if (!err) {
          t.fail(err, 'not null', 'Error should be set for a timeout');
        }
        done();
      });
    });

  });

  describe('seek and positioning', function() {
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        consumer.assign([{
          topic,
          partition: 0,
          offset: 0
        }]);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to seek', function(cb) {
      consumer.seek({
        topic,
        partition: 0,
        offset: 0
      }, 1, function(err) {
        t.ifError(err);
        cb();
      });
    });

    it('should be able to seek with a timeout of 0', function(cb) {
      consumer.seek({
        topic,
        partition: 0,
        offset: 0
      }, 0, function(err) {
        t.ifError(err);
        cb();
      });
    });
  });

  describe('subscribe', function() {

    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to subscribe', function() {
      t.equal(0, consumer.subscription().length);
      consumer.subscribe([topic]);
      t.equal(1, consumer.subscription().length);
      t.equal(topic, consumer.subscription()[0]);
      t.equal(0, consumer.assignments().length);
    });

    it('should be able to unsubscribe', function() {
      consumer.subscribe([topic]);
      t.equal(1, consumer.subscription().length);
      consumer.unsubscribe();
      t.equal(0, consumer.subscription().length);
      t.equal(0, consumer.assignments().length);
    });
  });

  describe('assign', function() {

    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to take an assignment', function() {
      t.equal(0, consumer.assignments().length);
      consumer.assign([{ topic:topic, partition:0 }]);
      t.equal(1, consumer.assignments().length);
      t.equal(topic, consumer.assignments()[0].topic);
      t.equal(0, consumer.subscription().length);
    });

    it('should be able to take an empty assignment', function() {
      consumer.assign([{ topic:topic, partition:0 }]);
      t.equal(1, consumer.assignments().length);
      consumer.assign([]);
      t.equal(0, consumer.assignments().length);
    });
  });

  describe('disconnect', function() {
    var tcfg = { 'auto.offset.reset': 'earliest' };

    it('should happen gracefully', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.disconnect(function() {
          cb();
        });

      });

    });

    it('should happen without issue after subscribing', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe([topic]);

        consumer.disconnect(function() {
          cb();
        });

      });

    });

    it('should happen without issue after consuming', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);
      consumer.setDefaultConsumeTimeout(10000);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe([topic]);

        consumer.setDefaultConsumeTimeout(500); // Topic might not have any messages.
        consumer.consume(1, function(err, messages) {
          t.ifError(err);

          consumer.disconnect(function() {
            cb();
          });
        });

      });

    });

    it('should happen without issue after consuming an error', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.setDefaultConsumeTimeout(1);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe([topic]);

        consumer.consume(1, function(err, messages) {

          // Timeouts do not classify as errors anymore
          t.equal(messages[0], undefined, 'Message should not be set');

          consumer.disconnect(function() {
            cb();
          });
        });

      });
    });

  });
});
