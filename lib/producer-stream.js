/*
 * confluent-kafka-javascript - Node.js wrapper  for RdKafka C/C++ library
 *
 * Copyright (c) 2016-2023 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

'use strict';

module.exports = ProducerStream;

var Writable = require('stream').Writable;
var util = require('util');
var ErrorCode = require('./error').codes;
var { Buffer } = require('buffer');

util.inherits(ProducerStream, Writable);

/**
 * Writable stream integrating with the Kafka Producer.
 *
 * This class is used to write data to Kafka in a streaming way. It takes
 * buffers of data and puts them into the appropriate Kafka topic. If you need
 * finer control over partitions or keys, this is probably not the class for
 * you. In that situation just use the Producer itself.
 *
 * The stream detects if Kafka is already connected. You can safely begin
 * writing right away.
 *
 * This stream does not operate in Object mode and can only be given buffers.
 *
 * Do not instantiate this directly, instead, use the {@link RdKafka.Producer.createWriteStream} method.
 *
 * @example
 * // This call returns a new writable stream to our topic 'topic-name'
 * const stream = Kafka.Producer.createWriteStream({
 *   'bootstrap.servers': 'localhost:9092'
 * }, {}, {
 *   topic: 'topic-name'
 * });
 *
 * // Writes a message to the stream
 * const queuedSuccess = stream.write(Buffer.from('Awesome message'));
 *
 * if (!queuedSuccess) {
 *   // Note that this only tells us if the stream's queue is full,
 *   // it does not tell us if there was an error getting the message to the
 *   // cluster.
 *   console.log('Too many messages in our queue already, retry later.');
 * }
 *
 * // It is necessary to listen to errors.
 * // Otherwise, any error will bubble up as an uncaught exception.
 * stream.on('error', (err) => {
 *   console.error('Error in our kafka stream');
 * });
 *
 * @param {RdKafka.Producer} producer - The Kafka Producer object.
 * @param {array} topics - Array of topics.
 * @param {object} options - Topic configuration.
 * @constructor
 * @extends stream.Writable
 * @memberof RdKafka
 */
function ProducerStream(producer, options) {
  if (!(this instanceof ProducerStream)) {
    return new ProducerStream(producer, options);
  }

  if (options === undefined) {
    options = {};
  } else if (typeof options === 'string') {
    options = { encoding: options };
  } else if (options === null || typeof options !== 'object') {
    throw new TypeError('"streamOptions" argument must be a string or an object');
  }

  if (!options.objectMode && !options.topic) {
    throw new TypeError('ProducerStreams not using objectMode must provide a topic to produce to.');
  }

  if (options.objectMode !== true) {
    this._write = this._write_buffer;
  } else {
    this._write = this._write_message;
  }

  Writable.call(this, options);

  this.producer = producer;
  this.topicName = options.topic;

  this.autoClose = options.autoClose === undefined ? true : !!options.autoClose;
  this.connectOptions = options.connectOptions || {};

  this.producer.setPollInterval(options.pollInterval || 1000);

  if (options.encoding) {
    this.setDefaultEncoding(options.encoding);
  }

  // Connect to the producer. Unless we are already connected
  if (!this.producer.isConnected()) {
    this.connect(this.connectOptions);
  }

  this.once('finish', function() {
    if (this.autoClose) {
      this.close();
    }
  });

}

ProducerStream.prototype.connect = function(options) {
  this.producer.connect(options, function(err) {
    if (err) {
      this.emit('error', err);
      return;
    }

  }.bind(this));
};

/**
 * Internal stream write method for ProducerStream when writing buffers.
 *
 * This method should never be called externally. It has some recursion to
 * handle cases where the producer is not yet connected.
 *
 * @param  {buffer} chunk - Chunk to write.
 * @param  {string} encoding - Encoding for the buffer
 * @param  {Function} cb - Callback to call when the stream is done processing
 * the data.
 * @private
 * @see https://github.com/nodejs/node/blob/master/lib/fs.js#L1901
 */
ProducerStream.prototype._write_buffer = function(data, encoding, cb) {
  if (!(data instanceof Buffer)) {
    this.emit('error', new Error('Invalid data. Can only produce buffers'));
    return;
  }

  var self = this;

  if (!this.producer.isConnected()) {
    this.producer.once('ready', function() {
      self._write(data, encoding, cb);
    });
    return;
  }

  try {
    this.producer.produce(self.topicName, null, data, null);
    setImmediate(cb);
  } catch (e) {
    if (ErrorCode.ERR__QUEUE_FULL === e.code) {
      // Poll for good measure
      self.producer.poll();

      // Just delay this thing a bit and pass the params
      // backpressure will get exerted this way.
      setTimeout(function() {
        self._write(data, encoding, cb);
      }, 500);
    } else {
      if (self.autoClose) {
        self.close();
      }
      setImmediate(function() {
        cb(e);
      });
    }
  }
};

/**
 * Internal stream write method for ProducerStream when writing objects.
 *
 * This method should never be called externally. It has some recursion to
 * handle cases where the producer is not yet connected.
 *
 * @param  {object} message - Message to write.
 * @param  {string} encoding - Encoding for the buffer
 * @param  {Function} cb - Callback to call when the stream is done processing
 * the data.
 * @private
 * @see https://github.com/nodejs/node/blob/master/lib/fs.js#L1901
 */
ProducerStream.prototype._write_message = function(message, encoding, cb) {
  var self = this;

  if (!this.producer.isConnected()) {
    this.producer.once('ready', function() {
      self._write(message, encoding, cb);
    });
    return;
  }

  try {
    this.producer.produce(message.topic, message.partition, message.value, message.key, message.timestamp, message.opaque, message.headers);
    setImmediate(cb);
  } catch (e) {
    if (ErrorCode.ERR__QUEUE_FULL === e.code) {
      // Poll for good measure
      self.producer.poll();

      // Just delay this thing a bit and pass the params
      // backpressure will get exerted this way.
      setTimeout(function() {
        self._write(message, encoding, cb);
      }, 500);
    } else {
      if (self.autoClose) {
        self.close();
      }
      setImmediate(function() {
        cb(e);
      });
    }
  }
};

function writev(producer, topic, chunks, cb) {

  // @todo maybe a produce batch method?
  var doneCount = 0;
  var err = null;
  var chunk = null;

  function maybeDone(e) {
    if (e) {
      err = e;
    }
    doneCount ++;
    if (doneCount === chunks.length) {
      cb(err);
    }
  }

  function retry(restChunks) {
    // Poll for good measure
    producer.poll();

    // Just delay this thing a bit and pass the params
    // backpressure will get exerted this way.
    setTimeout(function() {
      writev(producer, topic, restChunks, cb);
    }, 500);
  }

  for (var i = 0; i < chunks.length; i++) {
    chunk = chunks[i];

    try {
      if (Buffer.isBuffer(chunk)) {
        producer.produce(topic, null, chunk, null);
      } else {
        producer.produce(chunk.topic, chunk.partition, chunk.value, chunk.key, chunk.timestamp, chunk.opaque, chunk.headers);
      }
      maybeDone();
    } catch (e) {
      if (ErrorCode.ERR__QUEUE_FULL === e.code) {
        retry(chunks.slice(i));
      } else {
        cb(e);
      }
      break;
    }
  }

}

ProducerStream.prototype._writev = function(data, cb) {
  if (!this.producer.isConnected()) {
    this.once('ready', function() {
      this._writev(data, cb);
    });
    return;
  }

  var self = this;
  var len = data.length;
  var chunks = new Array(len);

  for (var i = 0; i < len; i++) {
    var chunk = data[i].chunk;

    chunks[i] = chunk;
  }

  writev(this.producer, this.topicName, chunks, function(err) {
    if (err) {
      self.close();
      cb(err);
      return;
    }
    cb();
  });

};

/**
 * Close the ProducerStream.
 *
 * This disconnects the underlying producer if required and closes the stream.
 * @param {function} cb - Callback to fire when the stream is closed.
 */
ProducerStream.prototype.close = function(cb) {
  var self = this;
  if (cb) {
    this.once('close', cb);
  }

  // Use interval variables in here
  if (self.producer._isConnected) {
    self.producer.disconnect(function() {
      // Previously this set the producer to null. I'm not sure there is any benefit
      // to that other than I guess helping flag it for GC?
      // https://github.com/confluentinc/confluent-kafka-javascript/issues/344
      close();
    });
  } else if (self.producer._isConnecting){
    self.producer.once('ready', function() {
      // Don't pass CB this time because it has already been passed
      self.close();
    });
  } else {
    setImmediate(close);
  }

  function close() {
    self.emit('close');
  }
};
