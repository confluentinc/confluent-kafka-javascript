'use strict';

/**
 * Resource monitor for CPU and memory usage during benchmarks.
 * Samples at regular intervals and provides aggregated statistics.
 */
class ResourceMonitor {
    constructor(intervalMs = 100) {
        this.intervalMs = intervalMs;
        this.samples = [];
        this.interval = null;
        this.startTime = null;
        this.startCpu = null;
    }

    /**
     * Start monitoring resources.
     */
    start() {
        this.samples = [];
        this.startTime = process.hrtime.bigint();
        this.startCpu = process.cpuUsage();

        this.interval = setInterval(() => {
            this.takeSample();
        }, this.intervalMs);

        // Take initial sample
        this.takeSample();
    }

    /**
     * Take a single resource sample.
     */
    takeSample() {
        const cpuUsage = process.cpuUsage(this.startCpu);
        const memUsage = process.memoryUsage();

        this.samples.push({
            timestamp: process.hrtime.bigint(),
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            }
        });
    }

    /**
     * Stop monitoring and return aggregated results.
     * @returns {Object} Aggregated resource metrics
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        // Take final sample
        this.takeSample();

        return this.aggregate();
    }

    /**
     * Aggregate collected samples into statistics.
     * @returns {Object}
     */
    aggregate() {
        if (this.samples.length === 0) {
            return {
                cpu_avg_pct: 0,
                cpu_max_pct: 0,
                mem_avg_mb: 0,
                mem_peak_mb: 0,
                sample_count: 0
            };
        }

        const endTime = process.hrtime.bigint();
        const elapsedMs = Number(endTime - this.startTime) / 1e6;

        // Calculate CPU percentage
        // CPU usage is in microseconds, convert to percentage of elapsed time
        const lastSample = this.samples[this.samples.length - 1];
        const totalCpuUs = lastSample.cpu.user + lastSample.cpu.system;
        const cpuAvgPct = (totalCpuUs / 1000) / elapsedMs * 100;

        // Calculate per-sample CPU percentages for max
        const cpuPcts = [];
        for (let i = 1; i < this.samples.length; i++) {
            const prev = this.samples[i - 1];
            const curr = this.samples[i];
            const deltaTime = Number(curr.timestamp - prev.timestamp) / 1e6; // ms
            const deltaCpu = (curr.cpu.user + curr.cpu.system) - (prev.cpu.user + prev.cpu.system);
            const pct = (deltaCpu / 1000) / deltaTime * 100;
            cpuPcts.push(Math.min(pct, 100 * require('os').cpus().length)); // Cap at max cores
        }

        const cpuMaxPct = cpuPcts.length > 0 ? Math.max(...cpuPcts) : cpuAvgPct;

        // Memory statistics (RSS in MB)
        const rssValues = this.samples.map(s => s.memory.rss / (1024 * 1024));
        const memAvgMb = rssValues.reduce((a, b) => a + b, 0) / rssValues.length;
        const memPeakMb = Math.max(...rssValues);

        // Heap statistics
        const heapUsedValues = this.samples.map(s => s.memory.heapUsed / (1024 * 1024));
        const heapAvgMb = heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length;
        const heapPeakMb = Math.max(...heapUsedValues);

        return {
            cpu_avg_pct: Math.round(cpuAvgPct * 100) / 100,
            cpu_max_pct: Math.round(cpuMaxPct * 100) / 100,
            mem_avg_mb: Math.round(memAvgMb * 100) / 100,
            mem_peak_mb: Math.round(memPeakMb * 100) / 100,
            heap_avg_mb: Math.round(heapAvgMb * 100) / 100,
            heap_peak_mb: Math.round(heapPeakMb * 100) / 100,
            sample_count: this.samples.length,
            elapsed_ms: Math.round(elapsedMs)
        };
    }

    /**
     * Get current resource usage snapshot.
     * @returns {Object}
     */
    getCurrentUsage() {
        const cpuUsage = process.cpuUsage(this.startCpu);
        const memUsage = process.memoryUsage();

        return {
            cpu_user_us: cpuUsage.user,
            cpu_system_us: cpuUsage.system,
            heap_used_mb: Math.round(memUsage.heapUsed / (1024 * 1024) * 100) / 100,
            rss_mb: Math.round(memUsage.rss / (1024 * 1024) * 100) / 100
        };
    }
}

module.exports = ResourceMonitor;
