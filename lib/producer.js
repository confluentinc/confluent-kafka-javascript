/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *           (c) 2024 Confluent, Inc.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = Producer;

var Client = require('./client');

var util = require('util');
var Kafka = require('../librdkafka.js');
var ProducerStream = require('./producer-stream');
var LibrdKafkaError = require('./error');
var shallowCopy = require('./util').shallowCopy;

util.inherits(Producer, Client);

/**
 * Producer class for sending messages to Kafka
 *
 * This is the main entry point for writing data to Kafka. You
 * configure this like you do any other client, with a global
 * configuration and default topic configuration.
 *
 * Once you instantiate this object, you need to connect to it first.
 * This allows you to get the metadata and make sure the connection
 * can be made before you depend on it. After that, problems with
 * the connection will by brought down by using poll, which automatically
 * runs when a transaction is made on the object.
 *
 * Methods on a Producer will throw a [LibrdKafkaError]{@link RdKafka.LibrdKafkaError}
 * on failure.
 *
 * @param {object} conf - Key value pairs to configure the producer
 * @param {object?} topicConf - Key value pairs to create a default
 *                              topic configuration
 * @extends RdKafka.Client
 * @constructor
 * @memberof RdKafka
 * @see [Producer example]{@link https://github.com/confluentinc/confluent-kafka-javascript/blob/master/examples/node-rdkafka/producer.md}
 */
function Producer(conf, topicConf) {
  if (!(this instanceof Producer)) {
    return new Producer(conf, topicConf);
  }

  conf = shallowCopy(conf);
  topicConf = shallowCopy(topicConf);

  /**
   * Producer message. This is sent to the wrapper, not received from it
   *
   * @typedef {object} Producer~Message
   * @property {string|buffer} message - The buffer to send to Kafka.
   * @property {Topic} topic - The Kafka topic to produce to.
   * @property {number} partition - The partition to produce to. Defaults to
   * the partitioner
   * @property {string} key - The key string to use for the message.
   * @see Consumer~Message
   */

  var gTopic = conf.topic || false;
  var gPart = conf.partition || null;
  var dr_cb = conf.dr_cb || null;
  var dr_msg_cb = conf.dr_msg_cb || null;

  // delete keys we don't want to pass on
  delete conf.topic;
  delete conf.partition;

  delete conf.dr_cb;
  delete conf.dr_msg_cb;

  // client is an initialized producer object
  // @see NodeKafka::Producer::Init
  Client.call(this, conf, Kafka.Producer, topicConf);

  // Delete these keys after saving them in vars
  this.globalConfig = conf;
  this.topicConfig = topicConf;
  this.defaultTopic = gTopic || null;
  this.defaultPartition = gPart === null ? -1 : gPart;

  this.sentMessages = 0;

  this.pollInterval = undefined;

  if (dr_msg_cb || dr_cb) {
    this._cb_configs.event.delivery_cb =  function(err, report) {
      if (err) {
        err = LibrdKafkaError.create(err);
      }
      this.emit('delivery-report', err, report);
    }.bind(this);
    this._cb_configs.event.delivery_cb.dr_msg_cb = !!dr_msg_cb;

    if (typeof dr_cb === 'function') {
      this.on('delivery-report', dr_cb);
    }

  }
}

/**
 * Produce a message to Kafka asynchronously.
 *
 * This is the method mainly used in this class. Use it to produce
 * a message to Kafka.
 *
 * When this is sent off, there is no guarantee it is delivered, as the method
 * returns immediately after queuing the message in the library.
 *
 * If you need guaranteed delivery, change your `acks` settings and use delivery reports.
 *
 * @param {string} topic - The topic name to produce to.
 * @param {number|null} partition - The partition number to produce to.
 * @param {Buffer|null} message - The message to produce.
 * @param {string} key - The key associated with the message.
 * @param {number|null} timestamp - Timestamp to send with the message.
 * @param {object} opaque - An object you want passed along with this message, if provided.
 *                          This will be available in the delivery report
 * @param {object} headers - A list of custom key value pairs that provide message metadata.
 * @return {boolean} - throws an error if it failed, or returns true if not.
 */
Producer.prototype.produce = function(topic, partition, message, key, timestamp, opaque, headers) {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }

  // I have removed support for using a topic object. It is going to be removed
  // from librdkafka soon, and it causes issues with shutting down
  if (!topic || typeof topic !== 'string') {
    throw new TypeError('"topic" must be a string');
  }

  this.sentMessages++;

  partition = partition === null ? this.defaultPartition : partition;

  return this._errorWrap(
    this._client.produce(topic, partition, message, key, timestamp, opaque, headers));

};

/**
 * Create a write stream interface for a producer.
 *
 * This stream does not run in object mode. It only takes buffers of data.
 *
 * @param {object} conf - Key value pairs to configure the producer.
 * @param {object} topicConf - Key value pairs to create a default topic configuration.
 * @param {object} streamOptions - Stream options.
 * @return {RdKafka.ProducerStream} - returns the write stream for writing to Kafka.
 */
Producer.createWriteStream = function(conf, topicConf, streamOptions) {
  var producer = new Producer(conf, topicConf);
  return new ProducerStream(producer, streamOptions);
};

/**
 * Poll for events.
 *
 * We need to run poll in order to learn about new events that have occurred.
 * This is not done automatically when we produce, so we need to run
 * it manually, or set the producer to automatically poll using
 * {@link RdKafka.Producer#setPollInterval} or {@link RdKafka.Producer#setPollInBackground}.
 *
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.poll = function() {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }
  this._client.poll();
  return this;
};

/**
 * Set automatic polling for events.
 *
 * We need to run poll in order to learn about new events that have occurred.
 * If you would like this done on an interval with disconnects and reconnections
 * managed, you can do it here.
 *
 * @param {number} interval - Interval, in milliseconds, to poll for.
 *
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.setPollInterval = function(interval) {
  // If we already have a poll interval we need to stop it
  if (this.pollInterval) {
    clearInterval(this.pollInterval);
    this.pollInterval = undefined;
  }

  if (interval === 0) {
    // If the interval was set to 0, bail out. We don't want to process this.
    // If there was an interval previously set, it has been removed.
    return;
  }

  var self = this;

  // Now we want to make sure we are connected.
  if (!this._isConnected) {
    // If we are not, execute this once the connection goes through.
    this.once('ready', function() {
      self.setPollInterval(interval);
    });
    return;
  }

  // We know we are connected at this point.
  // Unref this interval
  this.pollInterval = setInterval(function() {
    try {
      self.poll();
    } catch {
      // We can probably ignore errors here as far as broadcasting.
      // Disconnection issues will get handled below
    }
  }, interval).unref();

  // Handle disconnections
  this.once('disconnected', function() {
    // Just rerun this function with interval 0. If any
    // poll interval is set, this will remove it
    self.setPollInterval(0);
  });

  return this;
};

/**
 * Set automatic polling for events on the librdkafka background thread.
 *
 * This provides several advantages over `setPollInterval`, as the polling
 * does not happen on the event loop, but on the C thread spawned by librdkafka,
 * and can be more efficient for high-throughput producers.
 *
 * If set = true, this will disable any polling interval set by `setPollInterval`.
 *
 * @param {boolean} set Whether to poll in the background or not.
 * @returns {RdKafka.Producer} - returns itself.
 */
Producer.prototype.setPollInBackground = function(set) {
  if (set) {
    this.setPollInterval(0); // Clear poll interval from JS.
  }
  this._client.setPollInBackground(set);
  return this;
};

/**
 * Flush the producer,
 *
 * The producer accumulates messages upto `linger.ms` on an internal buffer.
 * This method flushes on the buffer immediately. Do this before disconnects, usually.
 *
 * @param {number?} timeout - Number of milliseconds to try to flush before giving up.
 * @param {function?} callback - Callback to fire when the flush is done.
 *
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.flush = function(timeout, callback) {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }

  if (timeout === undefined || timeout === null) {
    timeout = 500;
  }

  this._client.flush(timeout, function(err) {
    if (err) {
      err = LibrdKafkaError.create(err);
    }

    if (callback) {
      callback(err);
    }
  });
  return this;
};

/**
 * Save the base disconnect method here so we can overwrite it and add a flush.
 * @private
 */
Producer.prototype._disconnect = Producer.prototype.disconnect;

/**
 * Disconnect the producer.
 *
 * Flush everything on the internal librdkafka producer buffer. Then disconnect.
 *
 * @param {number?} timeout - Number of milliseconds to try to flush before giving up, defaults to 5 seconds.
 * @param {function?} cb - The callback to fire when disconnected.
 */
Producer.prototype.disconnect = function(timeout, cb) {
  var self = this;
  var timeoutInterval = 5000;

  if (typeof timeout === 'function') {
    cb = timeout;
  } else {
    timeoutInterval = timeout;
  }

  this.flush(timeoutInterval, function() {
    self._disconnect(cb);
  });
};

/**
 * Initialize transactions for this producer instance.
 *
 * Initialize transactions, this must only be performed once per transactional producer,
 * before it can be used.
 *
 * @param {number} timeout - Number of milliseconds to try to initialize before giving up, defaults to 5 seconds.
 * @param {function} cb - Callback to fire when operation is completed.
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.initTransactions = function(timeout, cb) {
  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }
  this._client.initTransactions(timeout, function(err) {
    cb(err ? LibrdKafkaError.create(err) : err);
  });
};

/**
 * Begin a transaction.
 *
 * `initTransaction` must have been called successfully (once) before this function is called.
 *
 * There can only be one ongoing transaction at a time.
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.beginTransaction = function(cb) {
  this._client.beginTransaction(function(err) {
    cb(err ? LibrdKafkaError.create(err) : err);
  });
};

/**
 * Commit the current transaction (as started with `beginTransaction`).
 *
 * @param {number} timeout - Number of milliseconds to try to commit before giving up, defaults to 5 seconds.
 * @param {function} cb - Callback to fire when operation is completed.
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.commitTransaction = function(timeout, cb) {
  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }
  this._client.commitTransaction(timeout, function(err) {
    cb(err ? LibrdKafkaError.create(err) : err);
  });
};

/**
 * Aborts the ongoing transaction (as started with `beginTransaction`).
 *
 * @param {number} timeout - Number of milliseconds to try to abort, defaults to 5 seconds.
 * @param {function} cb - Callback to fire when operation is completed.
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.abortTransaction = function(timeout, cb) {
  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }
  this._client.abortTransaction(timeout, function(err) {
    cb(err ? LibrdKafkaError.create(err) : err);
  });
};

/**
 * Send the current offsets of the consumer to the ongoing transaction.
 *
 * @param {RdKafka.TopicPartition[]} offsets - An array of topic-partitions with offsets filled in.
 * @param {RdKafka.KafkaConsumer} consumer - An instance of the consumer to send offsets for.
 * @param {number} timeout - Number of milliseconds to try to send offsets, defaults to 5 seconds.
 * @param {function} cb - Callback to return when operation is completed.
 * @return {RdKafka.Producer} - returns itself.
 */
Producer.prototype.sendOffsetsToTransaction = function(offsets, consumer, timeout, cb) {
  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }
  this._client.sendOffsetsToTransaction(offsets, consumer.getClient(), timeout, function(err) {
    cb(err ? LibrdKafkaError.create(err) : err);
  });
};
