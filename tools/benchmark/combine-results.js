#!/usr/bin/env node
'use strict';

/**
 * Utility script to combine multiple JSON result files into a single HTML report.
 *
 * Usage:
 *   node combine-results.js results/*.json -o combined-report.html
 */

const path = require('path');
const CombinedHtmlReporter = require('./lib/output/combined-html-reporter');

function printUsage() {
    console.log('Usage: node combine-results.js <file1.json> <file2.json> ... [-o output.html]');
    console.log('');
    console.log('Combines multiple benchmark JSON result files into a single HTML comparison report.');
    console.log('');
    console.log('Options:');
    console.log('  -o, --output <file>  Output HTML file (default: combined-report.html)');
    console.log('  -h, --help           Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node combine-results.js results/*.json');
    console.log('  node combine-results.js balanced.json high_throughput.json -o comparison.html');
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        printUsage();
        process.exit(0);
    }

    // Parse arguments
    let outputFile = 'combined-report.html';
    const inputFiles = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-o' || args[i] === '--output') {
            outputFile = args[++i];
        } else if (!args[i].startsWith('-')) {
            inputFiles.push(args[i]);
        }
    }

    if (inputFiles.length === 0) {
        console.error('Error: No input files specified.');
        printUsage();
        process.exit(1);
    }

    console.log(`Combining ${inputFiles.length} result files...`);

    try {
        const results = CombinedHtmlReporter.loadResults(inputFiles);
        const outputDir = path.dirname(outputFile) || '.';
        const filename = path.basename(outputFile);

        await CombinedHtmlReporter.write(outputDir, filename, results);

        console.log(`Combined report written to: ${outputFile}`);
        console.log(`Presets included: ${results.map(r => r.preset).join(', ')}`);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
}

main();
