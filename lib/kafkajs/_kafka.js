const { Producer } = require('./_producer');
const { Consumer, PartitionAssigners } = require('./_consumer');
const error = require('./_error');
const { logLevel } = require('./_common');

class Kafka {
  #commonClientConfig = {};

  /**
   *
   * @param {import("../../types/kafkajs").KafkaConfig} config
   */
  constructor(config) {
    this.#commonClientConfig = config ?? {};
  }

  /**
   * Merge the producer/consumer specific configuration with the common configuration.
   * @param {import("../../types/kafkajs").ProducerConfig|import("../../types/kafkajs").ConsumerConfig} config
   * @returns {(import("../../types/kafkajs").ProducerConfig & import("../../types/kafkajs").KafkaConfig) | (import("../../types/kafkajs").ConsumerConfig & import("../../types/kafkajs").KafkaConfig)}
   */
  #mergeConfiguration(config) {
    config = config ?? {};
    const mergedConfig = Object.assign({}, this.#commonClientConfig);

    mergedConfig.rdKafka = mergedConfig.rdKafka ?? {};

    if (typeof config.rdKafka === 'object') {
      Object.assign(mergedConfig.rdKafka, config.rdKafka);
      delete config.rdKafka;
    }

    Object.assign(mergedConfig, config);

    return mergedConfig;
  }

  /**
   * Creates a new producer.
   * @param {import("../../types/kafkajs").ProducerConfig} config
   * @returns {Producer}
   */
  producer(config) {
    return new Producer(this.#mergeConfiguration(config));
  }

  /**
   * Creates a new consumer.
   * @param {import("../../types/kafkajs").Consumer} config
   * @returns {Consumer}
   */
  consumer(config) {
    return new Consumer(this.#mergeConfiguration(config));
  }
}

module.exports = { Kafka, ...error, logLevel, PartitionAssigners, PartitionAssignors: PartitionAssigners };
