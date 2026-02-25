'use strict';

/**
 * Statistical utility functions for benchmark result aggregation.
 */

/**
 * Calculate arithmetic mean of values.
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
    if (values.length === 0) return 0;
    return values.reduce((acc, val) => acc + val, 0) / values.length;
}

/**
 * Calculate standard deviation of values.
 * @param {number[]} values
 * @returns {number}
 */
function stddev(values) {
    if (values.length <= 1) return 0;
    const avg = mean(values);
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(mean(squareDiffs));
}

/**
 * Calculate percentile of values.
 * @param {number[]} values
 * @param {number} p - Percentile (0-100)
 * @returns {number}
 */
function percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

/**
 * Calculate coefficient of variation (stddev / mean).
 * @param {number[]} values
 * @returns {number}
 */
function coefficientOfVariation(values) {
    const avg = mean(values);
    if (avg === 0) return 0;
    return stddev(values) / avg;
}

/**
 * Aggregate throughput metrics from multiple runs.
 * @param {number[]} values - Throughput values in MB/s
 * @returns {Object}
 */
function aggregateThroughput(values) {
    return {
        mean: mean(values),
        stddev: stddev(values),
        min: Math.min(...values),
        max: Math.max(...values),
        p50: percentile(values, 50),
        p90: percentile(values, 90),
        p95: percentile(values, 95),
        p99: percentile(values, 99),
        cv: coefficientOfVariation(values)
    };
}

/**
 * Aggregate latency metrics from multiple runs.
 * Each run should have latency object with mean, p50, p90, p95, p99.
 * @param {Object[]} latencyResults - Array of latency result objects
 * @returns {Object}
 */
function aggregateLatency(latencyResults) {
    if (!latencyResults || latencyResults.length === 0) return null;

    const metrics = ['mean', 'p50', 'p90', 'p95', 'p99'];
    const result = {};

    for (const metric of metrics) {
        const values = latencyResults.map(r => r[metric]).filter(v => v !== undefined);
        if (values.length > 0) {
            result[metric] = {
                mean: mean(values),
                stddev: stddev(values),
                min: Math.min(...values),
                max: Math.max(...values)
            };
        }
    }

    return result;
}

/**
 * Aggregate benchmark results from multiple runs.
 * @param {Object[]} results - Array of per-run result objects
 * @returns {Object}
 */
function aggregateResults(results) {
    const successfulRuns = results.filter(r => !r.error);
    const failedRuns = results.filter(r => r.error);

    if (successfulRuns.length === 0) {
        return {
            total_runs: results.length,
            successful_runs: 0,
            failed_runs: failedRuns.length,
            error: 'All runs failed'
        };
    }

    const throughputs = successfulRuns.map(r => r.throughput_mbps);
    const messagesPerSec = successfulRuns.map(r => r.messages_per_second);
    const durations = successfulRuns.map(r => r.duration_ms);

    const aggregated = {
        total_runs: results.length,
        successful_runs: successfulRuns.length,
        failed_runs: failedRuns.length,

        throughput_mbps: aggregateThroughput(throughputs),
        messages_per_second: aggregateThroughput(messagesPerSec),
        duration_ms: {
            mean: mean(durations),
            stddev: stddev(durations),
            min: Math.min(...durations),
            max: Math.max(...durations)
        }
    };

    // Aggregate latency if present
    const latencyRuns = successfulRuns.filter(r => r.latency);
    if (latencyRuns.length > 0) {
        aggregated.latency = aggregateLatency(latencyRuns.map(r => r.latency));
    }

    return aggregated;
}

module.exports = {
    mean,
    stddev,
    percentile,
    coefficientOfVariation,
    aggregateThroughput,
    aggregateLatency,
    aggregateResults
};
