'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Combined HTML reporter for comparing multiple benchmark presets.
 */
class CombinedHtmlReporter {
    /**
     * Generate combined HTML report from multiple result files.
     * @param {string} outputDir
     * @param {string} filename
     * @param {Object[]} results - Array of { preset, data } objects
     * @returns {Promise<void>}
     */
    static async write(outputDir, filename, results) {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const html = CombinedHtmlReporter.generateHtml(results);
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, html, 'utf8');
    }

    /**
     * Load and combine multiple JSON result files.
     * @param {string[]} filePaths - Array of JSON file paths
     * @returns {Object[]}
     */
    static loadResults(filePaths) {
        return filePaths.map(filePath => {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            const preset = data.config?.preset || path.basename(filePath, '.json');
            return { preset, data };
        });
    }

    /**
     * Generate combined HTML content.
     * @param {Object[]} results
     * @returns {string}
     */
    static generateHtml(results) {
        const timestamp = new Date().toISOString();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kafka Benchmark Comparison Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1"></script>
    <style>
        ${CombinedHtmlReporter.getCss()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Kafka Benchmark Comparison</h1>
            <div class="meta">
                <span class="badge">${results.length} Presets</span>
                <span class="timestamp">${timestamp}</span>
            </div>
        </header>

        ${CombinedHtmlReporter.generateOverviewTable(results)}
        ${CombinedHtmlReporter.generateComparisonCharts(results)}
        ${CombinedHtmlReporter.generateDetailSections(results)}
    </div>

    <script>
        ${CombinedHtmlReporter.getChartScript(results)}
    </script>
</body>
</html>`;
    }

    /**
     * Generate CSS styles.
     * @returns {string}
     */
    static getCss() {
        return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
.container { max-width: 1400px; margin: 0 auto; padding: 20px; }
header { text-align: center; margin-bottom: 30px; }
header h1 { font-size: 2rem; color: #1a1a2e; margin-bottom: 10px; }
.meta { display: flex; justify-content: center; gap: 10px; align-items: center; }
.badge { padding: 4px 12px; border-radius: 20px; font-size: 0.875rem; font-weight: 500; background: #4361ee; color: white; }
.timestamp { color: #666; font-size: 0.875rem; }

.section { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.section h2 { font-size: 1.25rem; color: #1a1a2e; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }

table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
th { background: #f8f9fa; font-weight: 600; color: #666; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px; }
tr:hover { background: #f8f9fa; }
.best { color: #22c55e; font-weight: 700; }
.worst { color: #ef4444; }

.charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-bottom: 20px; }
.chart-container { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.chart-container h3 { margin-bottom: 15px; color: #1a1a2e; }

.preset-section { margin-top: 20px; }
.preset-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.preset-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.875rem; font-weight: 500; }
`;
    }

    /**
     * Generate overview comparison table.
     * @param {Object[]} results
     * @returns {string}
     */
    static generateOverviewTable(results) {
        const benchmarkTypes = ['producer', 'consumer', 'ctp', 'latency'];

        // Collect throughput data
        const rows = results.map(({ preset, data }) => {
            const row = { preset };
            for (const type of benchmarkTypes) {
                const typeResults = data.results?.[type];
                row[type] = typeResults?.throughput_mbps?.mean || null;
            }
            return row;
        });

        // Find best/worst for each type
        const bests = {};
        const worsts = {};
        for (const type of benchmarkTypes) {
            const values = rows.map(r => r[type]).filter(v => v !== null);
            if (values.length > 0) {
                bests[type] = Math.max(...values);
                worsts[type] = Math.min(...values);
            }
        }

        const tableRows = rows.map(row => {
            const cells = benchmarkTypes.map(type => {
                if (row[type] === null) return '<td>-</td>';
                const value = row[type].toFixed(2);
                let className = '';
                if (row[type] === bests[type]) className = 'best';
                else if (row[type] === worsts[type]) className = 'worst';
                return `<td class="${className}">${value} MB/s</td>`;
            }).join('');
            return `<tr><td><strong>${row.preset}</strong></td>${cells}</tr>`;
        }).join('');

        return `
            <div class="section">
                <h2>Preset Comparison</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Preset</th>
                            ${benchmarkTypes.map(t => `<th>${t.toUpperCase()}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    /**
     * Generate comparison charts.
     * @param {Object[]} results
     * @returns {string}
     */
    static generateComparisonCharts(results) {
        return `
            <div class="charts-grid">
                <div class="chart-container">
                    <h3>Producer Throughput Comparison</h3>
                    <canvas id="producerCompareChart"></canvas>
                </div>
                <div class="chart-container">
                    <h3>Consumer Throughput Comparison</h3>
                    <canvas id="consumerCompareChart"></canvas>
                </div>
            </div>
        `;
    }

    /**
     * Generate detail sections for each preset.
     * @param {Object[]} results
     * @returns {string}
     */
    static generateDetailSections(results) {
        const colors = ['#4361ee', '#3f37c9', '#7209b7', '#f72585', '#4cc9f0', '#4895ef'];

        return results.map(({ preset, data }, index) => {
            const config = data.config || {};
            const benchmarkResults = data.results || {};

            const configItems = [
                `Mode: ${config.mode || 'confluent'}`,
                `Messages: ${config.stopping?.messageCount?.toLocaleString() || '-'}`,
                `Size: ${config.message?.size || '-'} bytes`,
                `Runs: ${config.runs || '-'}`
            ].map(item => `<span class="config-item">${item}</span>`).join('');

            const metrics = Object.entries(benchmarkResults).map(([type, result]) => {
                if (!result?.throughput_mbps) return '';
                return `
                    <div class="metric">
                        <strong>${type.toUpperCase()}</strong>:
                        ${result.throughput_mbps.mean?.toFixed(2) || '-'} MB/s
                        (±${result.throughput_mbps.stddev?.toFixed(2) || '-'})
                    </div>
                `;
            }).join('');

            return `
                <div class="section preset-section">
                    <div class="preset-header">
                        <h2>${preset}</h2>
                        <span class="preset-badge" style="background: ${colors[index % colors.length]}">${config.mode || 'confluent'}</span>
                    </div>
                    <div class="config-line">${configItems}</div>
                    <div class="metrics-grid">${metrics}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Generate Chart.js script for comparison charts.
     * @param {Object[]} results
     * @returns {string}
     */
    static getChartScript(results) {
        const presets = results.map(r => r.preset);
        const producerThroughputs = results.map(r => r.data.results?.producer?.throughput_mbps?.mean || 0);
        const consumerThroughputs = results.map(r => r.data.results?.consumer?.throughput_mbps?.mean || 0);
        const colors = ['#4361ee', '#3f37c9', '#7209b7', '#f72585', '#4cc9f0', '#4895ef'];

        return `
document.addEventListener('DOMContentLoaded', function() {
    const colors = ${JSON.stringify(colors)};

    new Chart(document.getElementById('producerCompareChart'), {
        type: 'bar',
        data: {
            labels: ${JSON.stringify(presets)},
            datasets: [{
                label: 'Producer Throughput (MB/s)',
                data: ${JSON.stringify(producerThroughputs)},
                backgroundColor: colors,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'MB/s' } } }
        }
    });

    new Chart(document.getElementById('consumerCompareChart'), {
        type: 'bar',
        data: {
            labels: ${JSON.stringify(presets)},
            datasets: [{
                label: 'Consumer Throughput (MB/s)',
                data: ${JSON.stringify(consumerThroughputs)},
                backgroundColor: colors,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'MB/s' } } }
        }
    });
});
`;
    }
}

module.exports = CombinedHtmlReporter;
