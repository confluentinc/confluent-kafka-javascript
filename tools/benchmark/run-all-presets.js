#!/usr/bin/env node
'use strict';

/**
 * Utility script to run benchmarks with all available presets.
 * Generates individual reports and a combined comparison report.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { listPresets } = require('./lib/config/preset-loader');
const CombinedHtmlReporter = require('./lib/output/combined-html-reporter');

const BENCHMARK_CLI = path.join(__dirname, 'index.js');
const RESULTS_DIR = path.join(__dirname, 'results');

async function main() {
    const args = process.argv.slice(2);
    const brokers = args.find(a => a.startsWith('--brokers='))?.split('=')[1] || 'localhost:9092';
    const runs = args.find(a => a.startsWith('--runs='))?.split('=')[1] || '3';
    const benchmarkType = args.find(a => !a.startsWith('--')) || 'producer';

    const presets = listPresets().filter(p => p !== 'custom');
    console.log(`Running ${benchmarkType} benchmark with presets: ${presets.join(', ')}`);
    console.log(`Brokers: ${brokers}`);
    console.log(`Runs per preset: ${runs}`);
    console.log('');

    const resultFiles = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const preset of presets) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Running preset: ${preset}`);
        console.log('='.repeat(60));

        try {
            execSync(
                `node ${BENCHMARK_CLI} ${benchmarkType} --preset ${preset} --brokers ${brokers} --runs ${runs} --json --create-topics`,
                { stdio: 'inherit' }
            );

            // Find the latest JSON file for this preset
            const files = fs.readdirSync(RESULTS_DIR)
                .filter(f => f.includes(preset) && f.endsWith('.json'))
                .sort()
                .reverse();

            if (files.length > 0) {
                resultFiles.push(path.join(RESULTS_DIR, files[0]));
            }
        } catch (err) {
            console.error(`Failed to run preset ${preset}: ${err.message}`);
        }
    }

    // Generate combined report
    if (resultFiles.length > 1) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('Generating combined comparison report...');
        console.log('='.repeat(60));

        const results = CombinedHtmlReporter.loadResults(resultFiles);
        const combinedFilename = `${timestamp}-combined-report.html`;
        await CombinedHtmlReporter.write(RESULTS_DIR, combinedFilename, results);

        console.log(`Combined report: ${RESULTS_DIR}/${combinedFilename}`);
    }

    console.log('\nAll presets completed.');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
