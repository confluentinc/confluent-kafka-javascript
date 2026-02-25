'use strict';

/**
 * Console reporter for live benchmark progress and summaries.
 */
class ConsoleReporter {
    constructor(config) {
        this.config = config;
        this.quiet = config.quiet || false;
    }

    /**
     * Print benchmark header.
     * @param {string} title
     */
    printHeader(title) {
        if (this.quiet) return;

        console.log('');
        console.log('='.repeat(60));
        console.log(title);
        console.log('='.repeat(60));
        console.log(`Mode: ${this.config.mode} | Runs: ${this.config.runs}`);
        console.log('-'.repeat(60));
    }

    /**
     * Print run start.
     * @param {number} runNumber
     * @param {number} totalRuns
     * @param {boolean} isWarmup
     */
    printRunStart(runNumber, totalRuns, isWarmup = false) {
        if (this.quiet) return;

        const prefix = isWarmup ? 'Warmup' : 'Run';
        process.stdout.write(`${prefix} ${runNumber}/${totalRuns}: Running...`);
    }

    /**
     * Print run completion.
     * @param {number} runNumber
     * @param {Object} result
     * @param {boolean} isWarmup
     */
    printRunComplete(runNumber, result, isWarmup = false) {
        if (this.quiet) return;

        // Clear the "Running..." text
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);

        const prefix = isWarmup ? 'Warmup' : 'Run';

        if (result) {
            const throughput = result.throughput_mbps?.toFixed(2) || 'N/A';
            const msgPerSec = result.messages_per_second?.toFixed(0) || 'N/A';
            const duration = (result.duration_ms / 1000).toFixed(2);

            let line = `${prefix} ${runNumber}: ${throughput} MB/s | ${msgPerSec} msg/s | ${duration}s`;

            if (result.latency) {
                line += ` | p50: ${result.latency.p50?.toFixed(2)}ms`;
            }

            console.log(line);
        } else {
            console.log(`${prefix} ${runNumber}: Complete`);
        }
    }

    /**
     * Print run error.
     * @param {number} runNumber
     * @param {Error} error
     * @param {boolean} isWarmup
     */
    printRunError(runNumber, error, isWarmup = false) {
        if (this.quiet) return;

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);

        const prefix = isWarmup ? 'Warmup' : 'Run';
        console.log(`${prefix} ${runNumber}: FAILED - ${error.message}`);
    }

    /**
     * Print aggregated summary.
     * @param {Object} aggregated
     */
    printSummary(aggregated) {
        if (this.quiet) return;

        console.log('');
        console.log('-'.repeat(60));
        console.log('SUMMARY');
        console.log('-'.repeat(60));

        console.log(`Successful runs: ${aggregated.successful_runs}/${aggregated.total_runs}`);

        if (aggregated.failed_runs > 0) {
            console.log(`Failed runs: ${aggregated.failed_runs}`);
        }

        if (aggregated.successful_runs === 0) {
            console.log('All runs failed. No statistics available.');
            return;
        }

        console.log('');

        // Throughput table
        this.printMetricTable('Throughput (MB/s)', aggregated.throughput_mbps);
        this.printMetricTable('Messages/sec', aggregated.messages_per_second);

        // Latency table if available
        if (aggregated.latency) {
            console.log('');
            console.log('Latency (ms):');
            for (const [metric, values] of Object.entries(aggregated.latency)) {
                if (values && typeof values === 'object') {
                    console.log(`  ${metric}: mean=${values.mean?.toFixed(2)}, min=${values.min?.toFixed(2)}, max=${values.max?.toFixed(2)}`);
                }
            }
        }

        console.log('');
    }

    /**
     * Print a metric table.
     * @param {string} name
     * @param {Object} stats
     */
    printMetricTable(name, stats) {
        if (!stats) return;

        const formatNum = (n, decimals = 2) => {
            if (n === undefined || n === null) return 'N/A';
            return typeof n === 'number' ? n.toFixed(decimals) : n;
        };

        console.log(`${name}:`);
        console.log(`  Mean: ${formatNum(stats.mean)} | StdDev: ${formatNum(stats.stddev)} | CV: ${formatNum(stats.cv, 3)}`);
        console.log(`  Min: ${formatNum(stats.min)} | Max: ${formatNum(stats.max)}`);
        console.log(`  P50: ${formatNum(stats.p50)} | P90: ${formatNum(stats.p90)} | P95: ${formatNum(stats.p95)}`);
    }

    /**
     * Print final report after all benchmarks.
     * @param {Object} allResults
     */
    printFinalReport(allResults) {
        if (this.quiet) return;

        console.log('');
        console.log('='.repeat(60));
        console.log('BENCHMARK COMPLETE');
        console.log('='.repeat(60));

        const types = ['producer', 'consumer', 'ctp', 'latency'];

        for (const type of types) {
            if (allResults[type]) {
                const result = allResults[type];
                const throughput = result.throughput_mbps?.mean?.toFixed(2) || 'N/A';
                console.log(`${type.toUpperCase()}: ${throughput} MB/s (mean of ${result.successful_runs} runs)`);
            }
        }

        console.log('');
    }
}

module.exports = ConsoleReporter;
