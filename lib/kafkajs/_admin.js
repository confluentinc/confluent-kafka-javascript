const RdKafka = require('../rdkafka');
const { kafkaJSToRdKafkaConfig,
  createKafkaJsErrorFromLibRdKafkaError,
  DefaultLogger,
  CompatibilityErrorMessages,
  logLevel,
  checkAllowedKeys } = require('./_common');
const error = require('./_error');

/**
 * NOTE: The Admin client is currently in an experimental state with many
 *       features missing or incomplete, and the API is subject to change.
 */

const AdminState = Object.freeze({
  INIT: 0,
  CONNECTING: 1,
  CONNECTED: 4,
  DISCONNECTING: 5,
  DISCONNECTED: 6,
});

class Admin {
  /**
   * The config supplied by the user.
   * @type {import("../../types/kafkajs").AdminConstructorConfig|null}
   */
  #userConfig = null;

  /**
   * The config realized after processing any compatibility options.
   * @type {import("../../types/config").GlobalConfig|null}
   */
  #internalConfig = null;

  /**
   * internalClient is the node-rdkafka client used by the API.
   * @type {import("../rdkafka").AdminClient|null}
   */
  #internalClient = null;
  /**
   * state is the current state of the admin client.
   * @type {AdminState}
   */
  #state = AdminState.INIT;

  /**
   * A logger for the admin client.
   * @type {import("../../types/kafkajs").Logger}
   */
  #logger = new DefaultLogger();

  /**
   * @constructor
   * @param {import("../../types/kafkajs").AdminConstructorConfig} config
   */
  constructor(config) {
    this.#userConfig = config;
  }

  #config() {
    if (!this.#internalConfig)
      this.#internalConfig = this.#finalizedConfig();
    return this.#internalConfig;
  }

  #kafkaJSToAdminConfig(kjsConfig) {
    if (!kjsConfig || Object.keys(kjsConfig).length === 0) {
      return {};
    }

    const disallowedKey = checkAllowedKeys('admin', kjsConfig);
    if (disallowedKey) {
      throw new error.KafkaJSError(CompatibilityErrorMessages.unsupportedKey(disallowedKey), { code: error.ErrorCodes.ERR__INVALID_ARG });
    }

    const rdKafkaConfig = kafkaJSToRdKafkaConfig(kjsConfig);
    return rdKafkaConfig;
  }

  #finalizedConfig() {
    let compatibleConfig = this.#kafkaJSToAdminConfig(this.#userConfig.kafkaJS);

    /* Set the logger's level in case we're not in compatibility mode - just set it to DEBUG, the broadest
     * log level, as librdkafka will control the granularity. */
    if (!compatibleConfig || Object.keys(compatibleConfig).length === 0) {
      this.#logger.setLogLevel(logLevel.DEBUG);
    }

    let rdKafkaConfig = Object.assign(compatibleConfig, this.#userConfig);

    /* Delete properties which are already processed, or cannot be passed to node-rdkafka */
    delete rdKafkaConfig.kafkaJS;

    return rdKafkaConfig;
  }

  /**
   * Set up the client and connect to the bootstrap brokers.
   * @returns {Promise<void>} Resolves when connection is complete, rejects on error.
   */
  async connect() {
    if (this.#state !== AdminState.INIT) {
      throw new error.KafkaJSError("Connect has already been called elsewhere.", { code: error.ErrorCodes.ERR__STATE });
    }

    this.#state = AdminState.CONNECTING;

    const config = this.#config();

    return new Promise((resolve, reject) => {
      try {
        /* AdminClient creation is a synchronous operation for node-rdkafka */
        this.#internalClient = RdKafka.AdminClient.create(config);
        this.#state = AdminState.CONNECTED;
        resolve();
      } catch (err) {
        reject(createKafkaJsErrorFromLibRdKafkaError(err));
      }
    });
  }

  /**
   * Disconnect from the brokers, clean-up and tear down the client.
   * @returns {Promise<void>} Resolves when disconnect is complete, rejects on error.
   */
  async disconnect() {
    /* Not yet connected - no error. */
    if (this.#state == AdminState.INIT) {
      return;
    }

    /* Already disconnecting, or disconnected. */
    if (this.#state >= AdminState.DISCONNECTING) {
      return;
    }

    this.#state = AdminState.DISCONNECTING;
    return new Promise((resolve, reject) => {
      try {
        /* AdminClient disconnect for node-rdkakfa is synchronous. */
        this.#internalClient.disconnect();
        this.#state = AdminState.DISCONNECTED;
        resolve();
      } catch (err) {
        reject(createKafkaJsErrorFromLibRdKafkaError(err));
      }
    });
  }


  /**
   * Converts a topic configuration object from kafkaJS to a format suitable for node-rdkafka.
   * @param {import("../../types/kafkajs").ITopicConfig} topic
   * @returns {import("../../index").NewTopic}
   */
  #topicConfigToRdKafka(topic) {
    let topicConfig = { topic: topic.topic };
    topicConfig.topic = topic.topic;
    topicConfig.num_partitions = topic.numPartitions ?? -1;
    topicConfig.replication_factor = topic.replicationFactor ?? -1;

    if (Object.hasOwn(topic, "replicaAssignment")) {
      throw new error.KafkaJSError("replicaAssignment is not yet implemented.", { code: error.ErrorCodes.ERR__NOT_IMPLEMENTED });
    }

    topicConfig.config = {};
    topic.configEntries = topic.configEntries ?? [];
    for (const configEntry of topic.configEntries) {
      topicConfig.config[configEntry.name] = configEntry.value;
    }

    return topicConfig;
  }

  /**
   * Create topics with the given configuration.
   * @param {{ validateOnly?: boolean, waitForLeaders?: boolean, timeout?: number, topics: import("../../types/kafkajs").ITopicConfig[] }} options
   * @returns {Promise<void>} Resolves when the topics are created, rejects on error.
   */
  async createTopics(options) {
    if (this.#state !== AdminState.CONNECTED) {
      throw new error.KafkaJSError("Admin client is not connected.", { code: error.ErrorCodes.ERR__STATE });
    }

    if (Object.hasOwn(options, "validateOnly")) {
      throw new error.KafkaJSError("validateOnly is not yet implemented.", { code: error.ErrorCodes.ERR__NOT_IMPLEMENTED });
    }

    if (Object.hasOwn(options, "waitForLeaders")) {
      throw new error.KafkaJSError("waitForLeaders is not yet implemented.", { code: error.ErrorCodes.ERR__NOT_IMPLEMENTED });
    }

    /* Convert each topic to a format suitable for node-rdkafka, and dispatch the call. */
    const ret =
      options.topics
        .map(this.#topicConfigToRdKafka)
        .map(topicConfig => new Promise((resolve, reject) => {
          this.#internalClient.createTopic(topicConfig, options.timeout ?? 5000, (err) => {
            if (err) {
              reject(createKafkaJsErrorFromLibRdKafkaError(err));
            } else {
              resolve();
            }
          });
        }));

    return Promise.all(ret);
  }

  /**
   * Deletes given topics.
   * @param {{topics: string[], timeout?: number}} options
   * @returns {Promise<void>} Resolves when the topics are deleted, rejects on error.
   */
  async deleteTopics(options) {
    if (this.#state !== AdminState.CONNECTED) {
      throw new error.KafkaJSError("Admin client is not connected.", { code: error.ErrorCodes.ERR__STATE });
    }

    return Promise.all(
      options.topics.map(topic => new Promise((resolve, reject) => {
        this.#internalClient.deleteTopic(topic, options.timeout ?? 5000, err => {
          if (err) {
            reject(createKafkaJsErrorFromLibRdKafkaError(err));
          } else {
            resolve();
          }
        });
      }))
    );
  }

  /**
   * List consumer groups.
   *
   * @param {object?} options
   * @param {number?} options.timeout - The request timeout in milliseconds.
   *                                    May be unset (default: 5000)
   * @param {import("../../types/kafkajs").ConsumerGroupStates[]?} options.matchConsumerGroupStates -
   *        A list of consumer group states to match. May be unset, fetches all states (default: unset).
   * @returns {Promise<{ groups: import("../../types/kafkajs").GroupOverview[], errors: import("../../types/kafkajs").LibrdKafkaError[] }>}
   *          Resolves with the list of consumer groups, rejects on error.
   */
  async listGroups(options = {}) {
    if (this.#state !== AdminState.CONNECTED) {
      throw new error.KafkaJSError("Admin client is not connected.", { code: error.ErrorCodes.ERR__STATE });
    }

    return new Promise((resolve, reject) => {
      this.#internalClient.listGroups(options, (err, groups) => {
        if (err) {
          reject(createKafkaJsErrorFromLibRdKafkaError(err));
        } else {
          resolve(groups);
        }
      });
    });
  }

  /**
   * Describe consumer groups.
   *
   * @param {string[]} groups - The names of the groups to describe.
   * @param {object?} options
   * @param {number?} options.timeout - The request timeout in milliseconds.
   *                                    May be unset (default: 5000)
   * @param {boolean?} options.includeAuthorizedOperations - If true, include operations allowed on the group by the calling client (default: false).
   * @returns {Promise<import("../../types/kafkajs").GroupDescriptions>}
   */
  async describeGroups(groups, options = {}) {
    if (this.#state !== AdminState.CONNECTED) {
      throw new error.KafkaJSError("Admin client is not connected.", { code: error.ErrorCodes.ERR__STATE });
    }

    return new Promise((resolve, reject) => {
      this.#internalClient.describeGroups(groups, options, (err, descriptions) => {
        if (err) {
          reject(createKafkaJsErrorFromLibRdKafkaError(err));
        } else {
          resolve(descriptions);
        }
      });
    });
  }

  /**
   * Delete consumer groups.
   * @param {string[]} groups - The names of the groups to delete.
   * @param {any?} options
   * @param {number?} options.timeout - The request timeout in milliseconds.
   *                                    May be unset (default: 5000)
   * @returns {Promise<import("../../types/kafkajs").DeleteGroupsResult[]>}
   */
  async deleteGroups(groups, options = {}) {
    if (this.#state !== AdminState.CONNECTED) {
      throw new error.KafkaJSError("Admin client is not connected.", { code: error.ErrorCodes.ERR__STATE });
    }

    return new Promise((resolve, reject) => {
      this.#internalClient.deleteGroups(groups, options, (err, reports) => {
        if (err) {
          reject(createKafkaJsErrorFromLibRdKafkaError(err));
        } else {
          resolve(reports);
        }
      });
    });
  }
}

module.exports = {
  Admin,
  ConsumerGroupStates: RdKafka.AdminClient.ConsumerGroupStates,
  AclOperationTypes: RdKafka.AdminClient.AclOperationTypes
}
