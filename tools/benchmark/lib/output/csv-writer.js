'use strict';

const fs = require('fs');
const path = require('path');

/**
 * CSV output writer for benchmark results.
 */
class CsvWriter {
    /**
     * Write results to CSV file.
     * @param {string} outputDir - Output directory
     * @param {string} filename - Output filename
     * @param {Object} data - Results data (may contain multiple benchmark types)
     * @returns {Promise<void>}
     */
    static async write(outputDir, filename, data) {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const rows = [];
        const headers = [
            'benchmark_type',
            'run',
            'timestamp',
            'duration_ms',
            'messages',
            'bytes',
            'throughput_mbps',
            'messages_per_sec',
            'latency_mean_ms',
            'latency_p50_ms',
            'latency_p90_ms',
            'latency_p95_ms',
            'error'
        ];

        rows.push(headers.join(','));

        // Process each benchmark type
        for (const [type, result] of Object.entries(data)) {
            if (result && result.individual_runs) {
                for (const run of result.individual_runs) {
                    const row = [
                        type,
                        run.run_number || '',
                        run.timestamp || '',
                        run.duration_ms?.toFixed(2) || '',
                        run.messages || '',
                        run.bytes || '',
                        run.throughput_mbps?.toFixed(4) || '',
                        run.messages_per_second?.toFixed(2) || '',
                        run.latency?.mean?.toFixed(4) || '',
                        run.latency?.p50?.toFixed(4) || '',
                        run.latency?.p90?.toFixed(4) || '',
                        run.latency?.p95?.toFixed(4) || '',
                        run.error || ''
                    ];
                    rows.push(row.join(','));
                }
            }
        }

        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, rows.join('\n'), 'utf8');

        // Also write summary CSV
        await CsvWriter.writeSummary(outputDir, filename.replace('.csv', '-summary.csv'), data);
    }

    /**
     * Write summary CSV with aggregated statistics.
     * @param {string} outputDir
     * @param {string} filename
     * @param {Object} data
     * @returns {Promise<void>}
     */
    static async writeSummary(outputDir, filename, data) {
        const rows = [];
        const headers = [
            'benchmark_type',
            'runs',
            'successful_runs',
            'mean_throughput_mbps',
            'stddev_throughput_mbps',
            'min_throughput_mbps',
            'max_throughput_mbps',
            'p50_throughput_mbps',
            'p95_throughput_mbps',
            'mean_latency_ms',
            'p50_latency_ms',
            'p95_latency_ms'
        ];

        rows.push(headers.join(','));

        for (const [type, result] of Object.entries(data)) {
            if (result && result.throughput_mbps) {
                const tp = result.throughput_mbps;
                const lat = result.latency?.mean || {};

                const row = [
                    type,
                    result.total_runs || '',
                    result.successful_runs || '',
                    tp.mean?.toFixed(4) || '',
                    tp.stddev?.toFixed(4) || '',
                    tp.min?.toFixed(4) || '',
                    tp.max?.toFixed(4) || '',
                    tp.p50?.toFixed(4) || '',
                    tp.p95?.toFixed(4) || '',
                    lat.mean?.toFixed(4) || '',
                    result.latency?.p50?.mean?.toFixed(4) || '',
                    result.latency?.p95?.mean?.toFixed(4) || ''
                ];
                rows.push(row.join(','));
            }
        }

        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, rows.join('\n'), 'utf8');
    }
}

module.exports = CsvWriter;
