'use strict';

const fs = require('fs');
const path = require('path');

/**
 * JSON output writer for benchmark results.
 */
class JsonWriter {
    /**
     * Write results to JSON file.
     * @param {string} outputDir - Output directory
     * @param {string} filename - Output filename
     * @param {Object} data - Data to write
     * @returns {Promise<void>}
     */
    static async write(outputDir, filename, data) {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, filename);
        const jsonContent = JSON.stringify(data, null, 2);

        fs.writeFileSync(filePath, jsonContent, 'utf8');

        // Also write a 'latest.json' symlink/copy for easy access
        const latestPath = path.join(outputDir, 'latest.json');
        fs.writeFileSync(latestPath, jsonContent, 'utf8');
    }

    /**
     * Read results from JSON file.
     * @param {string} filePath - Path to JSON file
     * @returns {Object}
     */
    static read(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    }
}

module.exports = JsonWriter;
