'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');

/**
 * Docker broker manager for auto-starting/stopping a local Kafka broker.
 */
class DockerBroker {
    constructor(options = {}) {
        this.composeFile = options.composeFile || path.join(__dirname, '..', '..', 'docker-compose.yml');
        this.projectName = options.projectName || 'kafka-benchmark';
        this.healthTimeout = options.healthTimeout || 60000;
        this.healthInterval = options.healthInterval || 2000;
        this.started = false;
    }

    /**
     * Check if Docker is available.
     * @returns {boolean}
     */
    isDockerAvailable() {
        try {
            execSync('docker --version', { stdio: 'ignore' });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Check if docker-compose (or docker compose) is available.
     * @returns {string|null} - The compose command to use, or null if not available
     */
    getComposeCommand() {
        // Try docker compose (v2)
        try {
            execSync('docker compose version', { stdio: 'ignore' });
            return 'docker compose';
        } catch (err) {
            // Try docker-compose (v1)
            try {
                execSync('docker-compose --version', { stdio: 'ignore' });
                return 'docker-compose';
            } catch (err2) {
                return null;
            }
        }
    }

    /**
     * Start the Kafka broker.
     * @returns {Promise<void>}
     */
    async start() {
        const composeCmd = this.getComposeCommand();
        if (!composeCmd) {
            throw new Error('Docker Compose is not available. Please install Docker.');
        }

        console.log('Starting Kafka broker via Docker...');

        try {
            execSync(
                `${composeCmd} -f ${this.composeFile} -p ${this.projectName} up -d`,
                { stdio: 'inherit' }
            );
            this.started = true;
        } catch (err) {
            throw new Error(`Failed to start Docker broker: ${err.message}`);
        }

        // Wait for broker to be healthy
        await this.waitForHealth();
        console.log('Kafka broker is ready.');
    }

    /**
     * Stop the Kafka broker.
     * @param {boolean} removeVolumes - Whether to remove volumes
     * @returns {Promise<void>}
     */
    async stop(removeVolumes = true) {
        if (!this.started) return;

        const composeCmd = this.getComposeCommand();
        if (!composeCmd) return;

        console.log('Stopping Kafka broker...');

        try {
            const volumeFlag = removeVolumes ? '-v' : '';
            execSync(
                `${composeCmd} -f ${this.composeFile} -p ${this.projectName} down ${volumeFlag}`,
                { stdio: 'inherit' }
            );
            this.started = false;
        } catch (err) {
            console.error(`Warning: Failed to stop Docker broker: ${err.message}`);
        }
    }

    /**
     * Wait for the broker to become healthy.
     * @returns {Promise<void>}
     */
    async waitForHealth() {
        const startTime = Date.now();

        while (Date.now() - startTime < this.healthTimeout) {
            if (await this.isHealthy()) {
                return;
            }
            await this.sleep(this.healthInterval);
        }

        throw new Error(`Kafka broker did not become healthy within ${this.healthTimeout / 1000}s`);
    }

    /**
     * Check if the broker is healthy.
     * @returns {Promise<boolean>}
     */
    async isHealthy() {
        try {
            // Try to connect to the broker and list topics
            execSync(
                'docker exec kafka-benchmark-kafka-1 kafka-topics.sh --bootstrap-server localhost:9092 --list',
                { stdio: 'ignore', timeout: 5000 }
            );
            return true;
        } catch (err) {
            // Alternative: check container health status
            try {
                const result = execSync(
                    `docker inspect --format='{{.State.Health.Status}}' ${this.projectName}-kafka-1`,
                    { encoding: 'utf8', timeout: 5000 }
                ).trim();
                return result === 'healthy';
            } catch (err2) {
                return false;
            }
        }
    }

    /**
     * Get the broker address.
     * @returns {string}
     */
    getBrokerAddress() {
        return 'localhost:9092';
    }

    /**
     * Sleep for specified milliseconds.
     * @param {number} ms
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = DockerBroker;
