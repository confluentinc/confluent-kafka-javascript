'use strict';

const { ClientFactory } = require('./clients');
const { aggregateResults } = require('./statistics');
const LiveTable = require('./output/live-table');
const Summary = require('./output/summary');
const JsonWriter = require('./output/json-writer');
const CsvWriter = require('./output/csv-writer');
const HtmlReporter = require('./output/html-reporter');
const ResourceMonitor = require('./utils/resource-monitor');

/**
 * Benchmark runner that orchestrates multi-run benchmarks.
 */
class BenchmarkRunner {
    constructor(config) {
        this.config = config;
        this.client = ClientFactory.create(config.mode, config);
        this.liveTable = new LiveTable({ quiet: config.quiet });
        this.summary = new Summary({ quiet: config.quiet });
        this.results = {};
    }

    /**
     * Run all benchmark types.
     * @returns {Promise<Object>} - All benchmark results
     */
    async runAll() {
        const results = {};

        if (this.config.createTopics) {
            await this.createTopics();
        }

        // Run producer benchmark
        this.liveTable.printHeader('producer');
        results.producer = await this.runBenchmark('producer');

        // Run consumer benchmark (needs seeded topic)
        this.liveTable.printHeader('consumer');
        await this.seedTopicIfNeeded();
        results.consumer = await this.runBenchmark('consumer');

        // Run CTP benchmark
        this.liveTable.printHeader('ctp');
        await this.seedTopicIfNeeded();
        results.ctp = await this.runBenchmark('ctp');

        // Run latency benchmark
        this.liveTable.printHeader('latency');
        results.latency = await this.runBenchmark('latency');

        this.results = results;
        await this.writeResults('all');

        // Print final report
        this.summary.printFinalReport(results);

        return results;
    }

    /**
     * Run a specific benchmark type.
     * @param {string} type - Benchmark type: producer, consumer, ctp, latency
     * @returns {Promise<Object>} - Aggregated benchmark results
     */
    async runBenchmark(type) {
        const runs = this.config.runs;
        const warmupRuns = this.config.warmupRuns || 0;
        const individualResults = [];

        // Warmup runs (not included in results)
        for (let i = 0; i < warmupRuns; i++) {
            if (!this.config.quiet) {
                process.stdout.write(`Warmup ${i + 1}/${warmupRuns}: Running...`);
            }
            try {
                await this.executeSingleRun(type);
                if (!this.config.quiet) {
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    console.log(`Warmup ${i + 1}/${warmupRuns}: Complete`);
                }
            } catch (err) {
                if (!this.config.quiet) {
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    console.log(`Warmup ${i + 1}/${warmupRuns}: Failed - ${err.message}`);
                }
            }
        }

        // Print header for actual runs
        if (!this.config.quiet && warmupRuns === 0) {
            // Header already printed if no warmup
        }

        // Actual benchmark runs
        for (let i = 0; i < runs; i++) {
            try {
                const result = await this.executeSingleRun(type);
                result.run_number = i + 1;
                individualResults.push(result);

                // Print row in live table
                this.liveTable.printRow(i + 1, result);
            } catch (err) {
                const errorResult = {
                    run_number: i + 1,
                    error: err.message,
                    timestamp: new Date().toISOString()
                };
                individualResults.push(errorResult);
                this.liveTable.printError(i + 1, err);
            }
        }

        this.liveTable.printFooter();

        // Aggregate results
        const aggregated = aggregateResults(individualResults);
        aggregated.benchmark_type = type;
        aggregated.preset = this.config.preset || 'custom';
        aggregated.mode = this.config.mode;
        aggregated.completed_at = new Date().toISOString();
        aggregated.individual_runs = individualResults;

        // Aggregate resource metrics if present
        const resourceRuns = individualResults.filter(r => r.resources);
        if (resourceRuns.length > 0) {
            aggregated.resources = {
                cpu_avg_pct: this.mean(resourceRuns.map(r => r.resources.cpu_avg_pct)),
                cpu_max_pct: Math.max(...resourceRuns.map(r => r.resources.cpu_max_pct)),
                mem_avg_mb: this.mean(resourceRuns.map(r => r.resources.mem_avg_mb)),
                mem_peak_mb: Math.max(...resourceRuns.map(r => r.resources.mem_peak_mb))
            };
        }

        // Print summary
        this.summary.print(aggregated);

        // Store and write results
        this.results[type] = aggregated;
        await this.writeResults(type);

        return aggregated;
    }

    /**
     * Execute a single benchmark run with resource monitoring.
     * @param {string} type - Benchmark type
     * @returns {Promise<Object>} - Run result
     */
    async executeSingleRun(type) {
        const resourceMonitor = new ResourceMonitor(100);
        resourceMonitor.start();

        let result;
        try {
            switch (type) {
                case 'producer':
                    result = await this.client.runProducer();
                    break;
                case 'consumer':
                    result = await this.client.runConsumer();
                    break;
                case 'ctp':
                    result = await this.client.runCTP();
                    break;
                case 'latency':
                    result = await this.client.runLatency();
                    break;
                default:
                    throw new Error(`Unknown benchmark type: ${type}`);
            }
        } finally {
            const resources = resourceMonitor.stop();
            if (result) {
                result.resources = resources;
            }
        }

        return result;
    }

    /**
     * Create topics for benchmarking.
     * @returns {Promise<void>}
     */
    async createTopics() {
        if (!this.config.quiet) {
            console.log('Creating topics...');
        }
        await this.client.createTopics();
        if (!this.config.quiet) {
            console.log(`Created topics: ${this.config.topic}, ${this.config.topic2}`);
        }
    }

    /**
     * Seed topic with messages if needed for consumer benchmark.
     * @returns {Promise<void>}
     */
    async seedTopicIfNeeded() {
        if (!this.config.quiet) {
            console.log('Seeding topic with messages...');
        }
        await this.client.seedTopic();
    }

    /**
     * Write results to files.
     * @param {string} type - Benchmark type
     * @returns {Promise<void>}
     */
    async writeResults(type) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const preset = this.config.preset || 'custom';

        const fullResult = {
            metadata: {
                tool_version: '1.0.0',
                timestamp: new Date().toISOString(),
                hostname: require('os').hostname(),
                node_version: process.version,
                platform: process.platform,
                arch: process.arch
            },
            config: {
                preset: preset,
                mode: this.config.mode,
                brokers: this.config.brokers,
                topic: this.config.topic,
                topic2: this.config.topic2,
                stopping: this.config.stopping,
                producer: this.config.producer,
                consumer: this.config.consumer,
                message: this.config.message,
                ctp: this.config.ctp,
                latency: this.config.latency,
                runs: this.config.runs,
                warmupRuns: this.config.warmupRuns
            },
            results: type === 'all' ? this.results : { [type]: this.results[type] }
        };

        if (this.config.json) {
            const filename = `${timestamp}-${preset}-${type}.json`;
            await JsonWriter.write(this.config.outputDir, filename, fullResult);
            if (!this.config.quiet) {
                console.log(`JSON results written to: ${this.config.outputDir}/${filename}`);
            }
        }

        if (this.config.csv) {
            const filename = `${timestamp}-${preset}-${type}.csv`;
            const data = type === 'all' ? this.results : { [type]: this.results[type] };
            await CsvWriter.write(this.config.outputDir, filename, data);
            if (!this.config.quiet) {
                console.log(`CSV results written to: ${this.config.outputDir}/${filename}`);
            }
        }

        if (this.config.html) {
            const filename = `${timestamp}-${preset}-${type}.html`;
            await HtmlReporter.write(this.config.outputDir, filename, fullResult);
            if (!this.config.quiet) {
                console.log(`HTML report written to: ${this.config.outputDir}/${filename}`);
            }
        }
    }

    /**
     * Calculate mean of array.
     * @param {number[]} values
     * @returns {number}
     */
    mean(values) {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
}

module.exports = BenchmarkRunner;
