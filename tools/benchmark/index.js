#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const path = require('path');
const { buildConfig, listPresets } = require('./lib/config/preset-loader');
const BenchmarkRunner = require('./lib/runner');
const DockerBroker = require('./lib/utils/docker-broker');
const CombinedHtmlReporter = require('./lib/output/combined-html-reporter');

const VERSION = '1.0.0';

const program = new Command();

program
    .name('kafka-benchmark')
    .description('Comprehensive benchmarking tool for confluent-kafka-javascript')
    .version(VERSION);

// Global options
program
    .option('-p, --preset <name>', 'Load preset configuration (balanced, high_throughput, low_latency, eos, sustained_throughput)', 'balanced')
    .option('-c, --config <file>', 'Load configuration from custom file')
    .option('--brokers <list>', 'Kafka broker addresses', 'localhost:9092')
    .option('--topic <name>', 'Primary topic name', 'benchmark-topic')
    .option('--topic2 <name>', 'Secondary topic name (for CTP)', 'benchmark-topic2')
    .option('--runs <n>', 'Number of benchmark runs', '3')
    .option('--warmup-runs <n>', 'Warmup runs (excluded from results)', '0')
    .option('--mode <type>', 'Client mode: confluent or rdkafka', 'confluent')
    .option('--message-count <n>', 'Messages per run (count-driven mode)')
    .option('--message-size <bytes>', 'Message size in bytes')
    .option('--batch-size <n>', 'Producer batch size')
    .option('--compression <type>', 'Compression codec: none, gzip, snappy, lz4, zstd')
    .option('--warmup-messages <n>', 'Warmup message count')
    .option('--duration <seconds>', 'Duration per run (time-driven mode)')
    .option('--output-dir <path>', 'Results output directory', path.join(__dirname, 'results'))
    .option('--json', 'Output results as JSON file')
    .option('--csv', 'Output results as CSV file')
    .option('--html', 'Output results as HTML report')
    .option('--quiet', 'Suppress live progress output')
    .option('--create-topics', 'Create topics before benchmark')
    .option('--auto-broker', 'Auto-start Kafka broker via Docker')
    .option('--keep-broker', 'Keep Docker broker running after benchmark');

let dockerBroker = null;

// Cleanup handler
async function cleanup() {
    if (dockerBroker && !program.opts().keepBroker) {
        await dockerBroker.stop();
    }
}

process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
});

// List presets command
program
    .command('list-presets')
    .description('List available benchmark presets')
    .action(() => {
        const presets = listPresets();
        console.log('Available presets:');
        presets.forEach(p => console.log(`  - ${p}`));
    });

// Combine results command
program
    .command('combine <files...>')
    .description('Combine multiple JSON result files into a single HTML report')
    .option('-o, --output <file>', 'Output HTML file', 'combined-report.html')
    .action(async (files, options) => {
        const results = CombinedHtmlReporter.loadResults(files);
        const outputDir = path.dirname(options.output);
        const filename = path.basename(options.output);
        await CombinedHtmlReporter.write(outputDir || '.', filename, results);
        console.log(`Combined report written to: ${options.output}`);
    });

/**
 * Setup broker if --auto-broker is specified.
 * @param {Object} config
 * @returns {Promise<Object>} Updated config with broker address
 */
async function setupBroker(config) {
    const opts = program.opts();

    if (opts.autoBroker) {
        dockerBroker = new DockerBroker();

        if (!dockerBroker.isDockerAvailable()) {
            throw new Error('Docker is required for --auto-broker. Please install Docker.');
        }

        await dockerBroker.start();
        config.brokers = dockerBroker.getBrokerAddress();
    }

    return config;
}

// Producer benchmark
program
    .command('producer')
    .description('Run producer throughput benchmark')
    .action(async () => {
        let config = buildConfig(program.opts());
        config = await setupBroker(config);

        const runner = new BenchmarkRunner(config);

        try {
            if (config.createTopics) {
                await runner.createTopics();
            }
            await runner.runBenchmark('producer');
        } finally {
            await cleanup();
        }
    });

// Consumer benchmark
program
    .command('consumer')
    .description('Run consumer throughput benchmark')
    .action(async () => {
        let config = buildConfig(program.opts());
        config = await setupBroker(config);

        const runner = new BenchmarkRunner(config);

        try {
            if (config.createTopics) {
                await runner.createTopics();
            }
            console.log('Seeding topic with messages...');
            await runner.client.seedTopic();
            await runner.runBenchmark('consumer');
        } finally {
            await cleanup();
        }
    });

// CTP benchmark
program
    .command('ctp')
    .description('Run consume-transform-produce benchmark')
    .action(async () => {
        let config = buildConfig(program.opts());
        config = await setupBroker(config);

        const runner = new BenchmarkRunner(config);

        try {
            if (config.createTopics) {
                await runner.createTopics();
            }
            console.log('Seeding topic with messages...');
            await runner.client.seedTopic();
            await runner.runBenchmark('ctp');
        } finally {
            await cleanup();
        }
    });

// Latency benchmark
program
    .command('latency')
    .description('Run end-to-end latency benchmark')
    .action(async () => {
        let config = buildConfig(program.opts());
        config = await setupBroker(config);

        const runner = new BenchmarkRunner(config);

        try {
            if (config.createTopics) {
                await runner.createTopics();
            }
            await runner.runBenchmark('latency');
        } finally {
            await cleanup();
        }
    });

// All benchmarks
program
    .command('all')
    .description('Run all benchmarks')
    .action(async () => {
        let config = buildConfig(program.opts());
        config = await setupBroker(config);

        const runner = new BenchmarkRunner(config);

        try {
            await runner.runAll();
        } finally {
            await cleanup();
        }
    });

// Default action (when no command specified)
program
    .action(async () => {
        const opts = program.opts();

        // If only options provided without command, show help
        if (process.argv.length <= 2) {
            program.help();
            return;
        }

        // Otherwise run all benchmarks with provided options
        let config = buildConfig(opts);
        config = await setupBroker(config);

        const runner = new BenchmarkRunner(config);

        try {
            await runner.runAll();
        } finally {
            await cleanup();
        }
    });

// Error handling
process.on('unhandledRejection', async (err) => {
    console.error('Benchmark failed:', err.message);
    if (process.env.DEBUG) {
        console.error(err.stack);
    }
    await cleanup();
    process.exit(1);
});

// Parse and run
program.parseAsync(process.argv).catch(async (err) => {
    console.error('Error:', err.message);
    await cleanup();
    process.exit(1);
});
