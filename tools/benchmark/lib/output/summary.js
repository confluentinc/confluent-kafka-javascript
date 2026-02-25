'use strict';

/**
 * Summary table output for aggregated benchmark results.
 */
class Summary {
    constructor(options = {}) {
        this.quiet = options.quiet || false;
    }

    /**
     * Print aggregated summary for a benchmark type.
     * @param {Object} aggregated - Aggregated results
     */
    print(aggregated) {
        if (this.quiet) return;

        console.log('');
        console.log('═'.repeat(80));
        console.log('SUMMARY');
        console.log('═'.repeat(80));

        console.log(`Benchmark Type: ${aggregated.benchmark_type || 'unknown'}`);
        console.log(`Preset: ${aggregated.preset || 'custom'}`);
        console.log(`Mode: ${aggregated.mode || 'confluent'}`);
        console.log(`Completed: ${aggregated.completed_at || new Date().toISOString()}`);
        console.log('');

        console.log(`Runs: ${aggregated.successful_runs}/${aggregated.total_runs} successful`);
        if (aggregated.failed_runs > 0) {
            console.log(`Failed: ${aggregated.failed_runs}`);
        }

        if (aggregated.successful_runs === 0) {
            console.log('');
            console.log('All runs failed. No statistics available.');
            return;
        }

        console.log('');

        // Throughput metrics
        this.printMetricSection('Throughput (MB/s)', aggregated.throughput_mbps);
        this.printMetricSection('Messages/second', aggregated.messages_per_second);
        this.printMetricSection('Duration (ms)', aggregated.duration_ms);

        // Latency metrics if present
        if (aggregated.latency) {
            console.log('');
            console.log('End-to-End Latency (ms):');
            for (const [metric, values] of Object.entries(aggregated.latency)) {
                if (values && typeof values === 'object' && values.mean !== undefined) {
                    console.log(`  ${metric.padEnd(6)}: mean=${values.mean.toFixed(2)}, min=${values.min.toFixed(2)}, max=${values.max.toFixed(2)}`);
                }
            }
        }

        // Delivery latency if present
        if (aggregated.delivery_latency) {
            console.log('');
            console.log('Delivery Report Latency (us):');
            this.printMetricSection('', aggregated.delivery_latency, '  ');
        }

        // Resource metrics if present
        if (aggregated.resources) {
            console.log('');
            console.log('Resource Usage:');
            console.log(`  CPU: avg=${aggregated.resources.cpu_avg_pct?.toFixed(1)}%, max=${aggregated.resources.cpu_max_pct?.toFixed(1)}%`);
            console.log(`  Memory: avg=${aggregated.resources.mem_avg_mb?.toFixed(1)} MB, peak=${aggregated.resources.mem_peak_mb?.toFixed(1)} MB`);
        }

        console.log('');
        console.log('═'.repeat(80));
    }

    /**
     * Print a metric section.
     * @param {string} title
     * @param {Object} stats
     * @param {string} indent
     */
    printMetricSection(title, stats, indent = '') {
        if (!stats) return;

        if (title) {
            console.log(`${indent}${title}:`);
        }

        const formatNum = (n, decimals = 2) => {
            if (n === undefined || n === null || isNaN(n)) return 'N/A';
            return n.toFixed(decimals);
        };

        console.log(`${indent}  Mean: ${formatNum(stats.mean)} ± ${formatNum(stats.stddev)} (stddev)`);
        console.log(`${indent}  Range: ${formatNum(stats.min)} - ${formatNum(stats.max)}`);
        console.log(`${indent}  Percentiles: p50=${formatNum(stats.p50)}, p90=${formatNum(stats.p90)}, p95=${formatNum(stats.p95)}, p99=${formatNum(stats.p99)}`);

        if (stats.cv !== undefined) {
            console.log(`${indent}  Coefficient of Variation: ${formatNum(stats.cv, 4)}`);
        }
    }

    /**
     * Print final report comparing multiple benchmark types.
     * @param {Object} allResults - Results keyed by benchmark type
     */
    printFinalReport(allResults) {
        if (this.quiet) return;

        console.log('');
        console.log('╔'.padEnd(79, '═') + '╗');
        console.log('║' + ' BENCHMARK COMPLETE '.padStart(50).padEnd(78) + '║');
        console.log('╚'.padEnd(79, '═') + '╝');
        console.log('');

        const types = ['producer', 'consumer', 'ctp', 'latency'];

        console.log('Type'.padEnd(12) + '│ ' + 'Throughput'.padEnd(14) + '│ ' + 'Msg/s'.padEnd(12) + '│ ' + 'Runs'.padEnd(8) + '│ ' + 'Status');
        console.log('─'.repeat(60));

        for (const type of types) {
            if (allResults[type]) {
                const result = allResults[type];
                const throughput = result.throughput_mbps?.mean?.toFixed(2) || 'N/A';
                const msgPerSec = result.messages_per_second?.mean?.toFixed(0) || 'N/A';
                const runs = `${result.successful_runs}/${result.total_runs}`;
                const status = result.failed_runs > 0 ? 'PARTIAL' : 'OK';

                console.log(
                    type.toUpperCase().padEnd(12) + '│ ' +
                    `${throughput} MB/s`.padEnd(14) + '│ ' +
                    msgPerSec.padEnd(12) + '│ ' +
                    runs.padEnd(8) + '│ ' +
                    status
                );
            }
        }

        console.log('');
    }
}

module.exports = Summary;
