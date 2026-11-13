/*
 * Regression for #272: produce must not retain opaque Persistent handles when
 * no delivery report callback is registered. Uses librdkafka's mock cluster so
 * NodeProduce runs for real inside `make test` (no external broker).
 */

var Producer = require('../lib/producer');
var t = require('assert');
var crypto = require('crypto');

function mockProducerConfig(extra) {
  var cfg = {
    'client.id': 'opaque-gc-test',
    'metadata.broker.list': 'localhost:9092',
    'test.mock.num.brokers': 1,
    'socket.timeout.ms': 10000,
    'allow.auto.create.topics': true
  };
  Object.keys(extra || {}).forEach(function(k) {
    cfg[k] = extra[k];
  });
  return cfg;
}

function connectProducer(producer, done) {
  producer.connect({}, function(err) {
    done(err);
  });
}

function disconnectProducer(producer, done) {
  producer.disconnect(10, function(err) {
    done(err);
  });
}

function waitUntil(predicate, timeoutMs, done) {
  var start = Date.now();
  function tick() {
    // make test does not pass --expose-gc; nudge the collector with junk
    // when global.gc is unavailable so FinalizationRegistry can fire.
    if (global.gc) {
      global.gc();
    } else {
      var junk = [];
      for (var i = 0; i < 40; i++) {
        junk.push(Buffer.alloc(1024 * 16));
      }
      junk = null;
    }
    if (predicate()) {
      return done(null);
    }
    if (Date.now() - start > timeoutMs) {
      return done(new Error('timed out waiting for condition'));
    }
    setTimeout(tick, 25);
  }
  setImmediate(tick);
}

module.exports = {
  'Producer opaque GC with mock cluster': {
    'without delivery callback, opaque values are not retained after produce': function(done) {
      this.timeout(30000);
      var topic = 'opaque-gc-' + crypto.randomBytes(6).toString('hex');
      var producer = new Producer(mockProducerConfig(), {});
      var collected = 0;
      var registry = new FinalizationRegistry(function() {
        collected++;
      });
      var total = 50;

      connectProducer(producer, function(err) {
        t.ifError(err);

        for (var i = 0; i < total; i++) {
          var opaque = { id: i, pad: Buffer.alloc(64, i % 255) };
          registry.register(opaque, i);
          var ok = producer.produce(
            topic,
            null,
            Buffer.from('msg-' + i),
            'key-' + i,
            Date.now(),
            opaque
          );
          t.equal(ok, true, 'produce should enqueue');
        }

        producer.flush(5000, function(flushErr) {
          t.ifError(flushErr);
          waitUntil(function() {
            return collected >= total;
          }, 15000, function(waitErr) {
            t.ifError(waitErr);
            t.ok(collected >= total, 'expected opaque objects to be garbage collected');
            disconnectProducer(producer, done);
          });
        });
      });
    },

    'with dr_cb, delivery reports carry the original opaque': function(done) {
      this.timeout(30000);
      var topic = 'opaque-dr-' + crypto.randomBytes(6).toString('hex');
      var producer = new Producer(mockProducerConfig({
        'dr_cb': true,
        'delivery.report.only.error': false
      }), {
        'request.required.acks': 1
      });
      var expected = {};
      var seen = {};
      var total = 20;

      producer.on('delivery-report', function(err, report) {
        t.ifError(err);
        t.ok(report && report.opaque, 'delivery report should include opaque');
        seen[report.opaque.id] = report.opaque;
      });

      connectProducer(producer, function(err) {
        t.ifError(err);
        producer.setPollInterval(10);

        for (var i = 0; i < total; i++) {
          var opaque = { id: i, tag: 'opaque-' + i };
          expected[i] = opaque;
          var ok = producer.produce(
            topic,
            null,
            Buffer.from('msg-' + i),
            'key-' + i,
            Date.now(),
            opaque
          );
          t.equal(ok, true, 'produce should enqueue');
        }

        producer.flush(5000, function(flushErr) {
          t.ifError(flushErr);
          waitUntil(function() {
            return Object.keys(seen).length >= total;
          }, 10000, function(waitErr) {
            t.ifError(waitErr);
            for (var i = 0; i < total; i++) {
              t.strictEqual(seen[i], expected[i], 'opaque identity should round trip for id ' + i);
              t.equal(seen[i].tag, 'opaque-' + i);
            }
            disconnectProducer(producer, done);
          });
        });
      });
    }
  }
};
