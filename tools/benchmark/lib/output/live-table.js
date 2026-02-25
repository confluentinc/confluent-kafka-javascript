'use strict';

/**
 * Live table output for real-time benchmark progress.
 * Displays one row per completed run with key metrics.
 */
class LiveTable {
    constructor(options = {}) {
        this.rowCount = 0;
        this.headerInterval = options.headerInterval || 20;
        this.quiet = options.quiet || false;
    }

    /**
     * Print table header.
     * @param {string} benchmarkType
     */
    printHeader(benchmarkType) {
        if (this.quiet) return;

        const header = this.formatRow([
            'Run',
            'Status',
            'Duration',
            'Messages',
            'Throughput',
            'Msg/s',
            'Latency P50',
            'CPU %',
            'Mem MB'
        ]);

        console.log('');
        console.log(`${benchmarkType.toUpperCase()} Benchmark`);
        console.log('─'.repeat(100));
        console.log(header);
        console.log('─'.repeat(100));
    }

    /**
     * Print a result row.
     * @param {number} runNumber
     * @param {Object} result
     */
    printRow(runNumber, result) {
        if (this.quiet) return;

        // Reprint header every N rows
        if (this.rowCount > 0 && this.rowCount % this.headerInterval === 0) {
            console.log('─'.repeat(100));
            const header = this.formatRow([
                'Run', 'Status', 'Duration', 'Messages', 'Throughput', 'Msg/s', 'Latency P50', 'CPU %', 'Mem MB'
            ]);
            console.log(header);
            console.log('─'.repeat(100));
        }

        const status = result.error ? 'FAIL' : 'OK';
        const duration = result.error ? '-' : `${(result.duration_ms / 1000).toFixed(2)}s`;
        const messages = result.error ? '-' : result.messages.toLocaleString();
        const throughput = result.error ? '-' : `${result.throughput_mbps.toFixed(2)} MB/s`;
        const msgPerSec = result.error ? '-' : result.messages_per_second.toFixed(0);

        // Latency (from e2e_latency or delivery_latency)
        let latencyP50 = '-';
        if (result.latency && result.latency.p50 !== undefined) {
            latencyP50 = `${result.latency.p50.toFixed(2)}ms`;
        } else if (result.e2e_latency && result.e2e_latency.p50_ms !== undefined) {
            latencyP50 = `${result.e2e_latency.p50_ms.toFixed(2)}ms`;
        } else if (result.delivery_latency && result.delivery_latency.p50_us !== undefined) {
            latencyP50 = `${(result.delivery_latency.p50_us / 1000).toFixed(2)}ms`;
        }

        // Resource usage
        const cpuPct = result.resources ? result.resources.cpu_avg_pct.toFixed(1) : '-';
        const memMb = result.resources ? result.resources.mem_avg_mb.toFixed(1) : '-';

        const row = this.formatRow([
            runNumber.toString(),
            status,
            duration,
            messages,
            throughput,
            msgPerSec,
            latencyP50,
            cpuPct,
            memMb
        ]);

        console.log(row);
        this.rowCount++;
    }

    /**
     * Print error row.
     * @param {number} runNumber
     * @param {Error} error
     */
    printError(runNumber, error) {
        if (this.quiet) return;

        const row = this.formatRow([
            runNumber.toString(),
            'FAIL',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-'
        ]);

        console.log(row);
        console.log(`  Error: ${error.message}`);
        this.rowCount++;
    }

    /**
     * Print footer/separator.
     */
    printFooter() {
        if (this.quiet) return;
        console.log('─'.repeat(100));
    }

    /**
     * Format a row with fixed column widths.
     * @param {string[]} columns
     * @returns {string}
     */
    formatRow(columns) {
        const widths = [5, 8, 10, 12, 14, 10, 12, 8, 10];
        return columns.map((col, i) => {
            const width = widths[i] || 10;
            return col.toString().padEnd(width);
        }).join(' │ ');
    }
}

module.exports = LiveTable;
