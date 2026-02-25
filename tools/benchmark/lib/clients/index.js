'use strict';

const ConfluentClient = require('./confluent-client');
const RdKafkaClient = require('./rdkafka-client');

/**
 * Factory for creating benchmark clients.
 */
class ClientFactory {
    /**
     * Create a benchmark client based on mode.
     * @param {string} mode - Client mode: 'confluent' or 'rdkafka'
     * @param {Object} config - Benchmark configuration
     * @returns {ConfluentClient|RdKafkaClient}
     */
    static create(mode, config) {
        switch (mode) {
            case 'confluent':
                return new ConfluentClient(config);
            case 'rdkafka':
                return new RdKafkaClient(config);
            default:
                throw new Error(`Unknown client mode: ${mode}. Available modes: confluent, rdkafka`);
        }
    }

    /**
     * List available client modes.
     * @returns {string[]}
     */
    static listModes() {
        return ['confluent', 'rdkafka'];
    }
}

module.exports = {
    ClientFactory,
    ConfluentClient,
    RdKafkaClient
};
