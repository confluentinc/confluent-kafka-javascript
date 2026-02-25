'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { mergeWithDefaults } = require('./defaults');

const PRESETS_DIR = path.join(__dirname, '..', '..', 'presets');

/**
 * List available preset names.
 * @returns {string[]}
 */
function listPresets() {
    try {
        const files = fs.readdirSync(PRESETS_DIR);
        return files
            .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
            .filter(f => !f.endsWith('.example'))
            .map(f => path.basename(f, path.extname(f)));
    } catch (err) {
        return [];
    }
}

/**
 * Load a preset by name.
 * @param {string} name - Preset name (without extension)
 * @returns {Object} - Parsed preset configuration
 */
function loadPreset(name) {
    const yamlPath = path.join(PRESETS_DIR, `${name}.yaml`);
    const ymlPath = path.join(PRESETS_DIR, `${name}.yml`);

    let filePath;
    if (fs.existsSync(yamlPath)) {
        filePath = yamlPath;
    } else if (fs.existsSync(ymlPath)) {
        filePath = ymlPath;
    } else {
        throw new Error(`Preset '${name}' not found. Available presets: ${listPresets().join(', ')}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const preset = yaml.load(content);

    return normalizePreset(preset);
}

/**
 * Load configuration from a custom file.
 * @param {string} filePath - Path to config file
 * @returns {Object} - Parsed configuration
 */
function loadConfigFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Configuration file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    let config;
    if (ext === '.yaml' || ext === '.yml') {
        config = yaml.load(content);
    } else if (ext === '.json') {
        config = JSON.parse(content);
    } else {
        throw new Error(`Unsupported config file format: ${ext}`);
    }

    return normalizePreset(config);
}

/**
 * Normalize preset keys from YAML snake_case to camelCase.
 * @param {Object} preset
 * @returns {Object}
 */
function normalizePreset(preset) {
    if (!preset) return {};

    const normalized = {};

    // Map snake_case keys to camelCase for common fields
    const keyMap = {
        'message_count': 'messageCount',
        'duration_seconds': 'durationSeconds',
        'batch_size': 'batchSize',
        'warmup_messages': 'warmupMessages',
        'linger_ms': 'lingerMs',
        'fetch_min_bytes': 'fetchMinBytes',
        'fetch_wait_max_ms': 'fetchWaitMaxMs',
        'auto_commit': 'autoCommit',
        'process_time_ms': 'processTimeMs',
        'producer_delay_ms': 'producerDelayMs',
        'consumer_delay_ms': 'consumerDelayMs',
        'key_size': 'keySize',
        'warmup_runs': 'warmupRuns',
        'output_dir': 'outputDir',
        'create_topics': 'createTopics'
    };

    for (const [key, value] of Object.entries(preset)) {
        const normalizedKey = keyMap[key] || key;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            normalized[normalizedKey] = normalizePreset(value);
        } else {
            normalized[normalizedKey] = value;
        }
    }

    return normalized;
}

/**
 * Build final configuration from preset, config file, and CLI options.
 * @param {Object} options - CLI options
 * @returns {Object} - Final configuration
 */
function buildConfig(options) {
    let config = {};

    // Load preset if specified
    if (options.preset) {
        try {
            config = loadPreset(options.preset);
        } catch (err) {
            console.error(`Warning: ${err.message}`);
        }
    }

    // Load config file if specified (overrides preset)
    if (options.config) {
        const fileConfig = loadConfigFile(options.config);
        config = { ...config, ...fileConfig };
    }

    // Apply CLI options (highest priority)
    const cliConfig = {};

    if (options.brokers) cliConfig.brokers = options.brokers;
    if (options.topic) cliConfig.topic = options.topic;
    if (options.topic2) cliConfig.topic2 = options.topic2;
    if (options.runs) cliConfig.runs = parseInt(options.runs, 10);
    if (options.mode) cliConfig.mode = options.mode;
    if (options.outputDir) cliConfig.outputDir = options.outputDir;
    if (options.json) cliConfig.json = true;
    if (options.csv) cliConfig.csv = true;
    if (options.html) cliConfig.html = true;
    if (options.quiet) cliConfig.quiet = true;
    if (options.createTopics) cliConfig.createTopics = true;

    // Stopping mode
    if (options.messageCount || options.duration) {
        cliConfig.stopping = cliConfig.stopping || {};
        if (options.messageCount) {
            cliConfig.stopping.mode = 'count';
            cliConfig.stopping.messageCount = parseInt(options.messageCount, 10);
        }
        if (options.duration) {
            cliConfig.stopping.mode = 'time';
            cliConfig.stopping.durationSeconds = parseInt(options.duration, 10);
        }
    }

    // Message settings
    if (options.messageSize) {
        cliConfig.message = cliConfig.message || {};
        cliConfig.message.size = parseInt(options.messageSize, 10);
    }

    // Producer settings
    if (options.batchSize || options.compression || options.warmupMessages) {
        cliConfig.producer = cliConfig.producer || {};
        if (options.batchSize) cliConfig.producer.batchSize = parseInt(options.batchSize, 10);
        if (options.compression) cliConfig.producer.compression = options.compression;
        if (options.warmupMessages) cliConfig.producer.warmupMessages = parseInt(options.warmupMessages, 10);
    }

    // Merge all configurations
    const merged = { ...config, ...cliConfig };

    // Merge with defaults
    return mergeWithDefaults(merged);
}

module.exports = {
    listPresets,
    loadPreset,
    loadConfigFile,
    buildConfig
};
