# Kafka Benchmark Tool

A comprehensive E2E performance benchmarking tool for confluent-kafka-javascript. Supports preset-based configuration, multi-run aggregation with statistics, structured output (JSON, CSV, HTML), interactive reports with Chart.js, and Docker integration for easy broker setup.

## Features

- **Preset-based configuration** - YAML presets for common scenarios (high_throughput, low_latency, balanced, eos, sustained_throughput)
- **Multi-run aggregation** - Run benchmarks N times and get mean, stddev, min, max, percentiles
- **Two stopping modes** - Count-driven (message count) or time-driven (duration)
- **Two client modes** - `confluent` (KafkaJS API) or `rdkafka` (raw node-rdkafka API)
- **Delivery latency tracking** - Producer benchmark tracks delivery report latency (time from send to ack)
- **Structured output** - JSON, CSV, and HTML reports for CI integration
- **HTML reports** - Interactive reports with Chart.js visualizations
- **Combined reports** - Compare multiple presets side-by-side
- **Resource monitoring** - CPU and memory usage tracking
- **Docker integration** - Auto-start Kafka broker via Docker
- **Live progress** - Terminal output with run-by-run progress

## Quick Start

```bash
# Install dependencies
cd tools/benchmark
npm install

# List available presets
node index.js list-presets

# Run all benchmarks with default settings
node index.js all --brokers localhost:9092

# Run with auto-started Docker broker
node index.js all --auto-broker --create-topics

# Run producer benchmark with high throughput preset
node index.js producer --preset high_throughput --runs 5 --json --html

# Run with custom settings
node index.js producer --runs 5 --message-count 500000 --message-size 1024
```

## Commands

### `all`
Run all benchmark types (producer, consumer, ctp, latency) and generate a combined report.

```bash
node index.js all --preset balanced --brokers localhost:9092 --runs 5
```

### `producer`
Run producer throughput benchmark. Measures throughput (MB/s, msgs/s) and delivery report latency.

```bash
node index.js producer --preset high_throughput --runs 3 --json --html
```

### `consumer`
Run consumer throughput benchmark. Automatically seeds the topic with messages first.

```bash
node index.js consumer --preset balanced --runs 3
```

### `ctp`
Run consume-transform-produce benchmark. Measures throughput for consuming, transforming, and producing messages.

```bash
node index.js ctp --preset balanced --runs 3
```

### `latency`
Run end-to-end latency benchmark. Measures produce-to-consume latency with percentiles.

```bash
node index.js latency --preset low_latency --runs 5
```

### `list-presets`
List all available benchmark presets with their configurations.

```bash
node index.js list-presets
```

### `combine <files...>`
Combine multiple JSON result files into a single HTML comparison report.

```bash
node index.js combine results/*.json -o comparison.html
```

## Options

### Connection Options

| Option | Description | Default |
|--------|-------------|---------|
| `--brokers <list>` | Kafka broker addresses | `localhost:9092` |
| `--topic <name>` | Primary topic name | `benchmark-topic` |
| `--topic2 <name>` | Secondary topic (CTP) | `benchmark-topic2` |
| `--auto-broker` | Auto-start Kafka via Docker | false |
| `--keep-broker` | Keep Docker broker after benchmark | false |

### Benchmark Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --preset <name>` | Preset configuration | `balanced` |
| `-c, --config <file>` | Custom config file | - |
| `--runs <n>` | Number of runs | `3` |
| `--warmup-runs <n>` | Warmup runs (excluded) | `0` |
| `--mode <type>` | Client: confluent or rdkafka | `confluent` |

### Workload Options

| Option | Description | Default |
|--------|-------------|---------|
| `--message-count <n>` | Messages per run | preset |
| `--message-size <bytes>` | Message size | preset |
| `--duration <seconds>` | Duration (time mode) | preset |
| `--batch-size <n>` | Producer batch size | preset |
| `--compression <type>` | Compression codec | preset |
| `--warmup-messages <n>` | Warmup messages | preset |

### Output Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output-dir <path>` | Results directory | `./results` |
| `--json` | Output JSON file | false |
| `--csv` | Output CSV file | false |
| `--html` | Output HTML report | false |
| `--quiet` | Suppress live output | false |
| `--create-topics` | Create topics first | false |

## Presets

| Preset | Description | Message Count | Compression |
|--------|-------------|---------------|-------------|
| `balanced` | General testing | 100,000 | none |
| `high_throughput` | Maximum throughput | 1,000,000 | lz4 |
| `low_latency` | Minimum latency | 10,000 | none |
| `eos` | Exactly-once semantics | 10,000 | none |
| `sustained_throughput` | Time-driven (60s) | unlimited | lz4 |

## Examples

### Basic Usage

```bash
# Run producer benchmark with default settings
node index.js producer

# Run all benchmarks with JSON output
node index.js all --json --csv --html

# Run with custom broker
node index.js all --brokers kafka1:9092,kafka2:9092
```

### Using Presets

```bash
# High throughput testing
node index.js producer --preset high_throughput --runs 5

# Low latency testing
node index.js latency --preset low_latency --runs 10

# Exactly-once semantics
node index.js producer --preset eos --runs 3
```

### Docker Integration

```bash
# Auto-start Kafka broker
node index.js all --auto-broker --create-topics

# Keep broker running for multiple runs
node index.js producer --auto-broker --keep-broker
node index.js consumer --brokers localhost:9092
```

### Comparing Presets

```bash
# Run all presets
node run-all-presets.js producer --brokers=localhost:9092 --runs=3

# Combine results into comparison report
node combine-results.js results/*-balanced-*.json results/*-high_throughput-*.json -o comparison.html
```

### CI/CD Usage

```bash
# Quiet mode with JSON output for CI
node index.js all --quiet --json --runs 5

# With specific thresholds (check exit code)
node index.js producer --preset balanced --quiet --json
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `KAFKA_BROKERS` | Broker addresses |
| `KAFKA_TOPIC` | Primary topic |
| `MESSAGE_COUNT` | Messages per run |
| `MESSAGE_SIZE` | Message size |
| `BATCH_SIZE` | Batch size |
| `COMPRESSION` | Compression codec |
| `BENCHMARK_RUNS` | Number of runs |
| `BENCHMARK_MODE` | Client mode |
| `OUTPUT_DIR` | Output directory |
| `DEBUG` | Enable debug output |

## Output

### Console Output

```
PRODUCER Benchmark
----------------------------------------------------------------------------------------------------
Run   | Status   | Duration   | Messages     | Throughput     | Msg/s      | Lat avg (ms) | Lat p95 (ms) | CPU %    | Mem MB
----------------------------------------------------------------------------------------------------
1     | OK       | 0.50s      | 100,000      | 75.58 MB/s     | 200,241    | 12.34        | 25.67        | 112.8    | 180.5
2     | OK       | 0.44s      | 100,000      | 77.95 MB/s     | 227,367    | 11.89        | 24.12        | 121.9    | 231.3
3     | OK       | 0.43s      | 100,000      | 79.23 MB/s     | 231,841    | 11.45        | 23.56        | 109.4    | 254.3
----------------------------------------------------------------------------------------------------

================================================================================
SUMMARY
================================================================================
Successful runs: 3/3

Throughput (MB/s):
  Mean: 77.59 +/- 1.51 (stddev)
  Range: 75.58 - 79.23
  Percentiles: p50=77.95, p90=79.23, p95=79.23, p99=79.23

Delivery Latency (ms):
  Mean: 11.89 +/- 0.37 (stddev)
  Percentiles: p50=11.89, p95=24.12, p99=26.34

Resource Usage:
  CPU: avg=114.7%, max=185.5%
  Memory: avg=196.9 MB, peak=254.3 MB
```

### HTML Report

Interactive HTML report with:
- Summary cards with key metrics (throughput, latency, resource usage)
- Chart.js bar/line charts for throughput and latency visualization
- Configuration panel showing all benchmark settings
- Per-run results table with delivery latency metrics
- Aggregated statistics with percentiles

### JSON Output

```json
{
  "metadata": {
    "tool_version": "1.0.0",
    "timestamp": "2024-02-24T10:35:00.000Z",
    "node_version": "v20.10.0",
    "platform": "darwin"
  },
  "config": {
    "preset": "balanced",
    "mode": "confluent",
    "brokers": "localhost:9092"
  },
  "results": {
    "producer": {
      "successful_runs": 3,
      "throughput_mbps": {
        "mean": 77.59,
        "stddev": 1.51,
        "min": 75.58,
        "max": 79.23,
        "p50": 77.95
      },
      "latency": {
        "mean": 11.89,
        "p50": 11.89,
        "p95": 24.12,
        "p99": 26.34,
        "min": 8.45,
        "max": 31.23
      },
      "resources": {
        "cpu_avg_pct": 114.7,
        "cpu_max_pct": 185.5,
        "mem_avg_mb": 196.9,
        "mem_peak_mb": 254.3
      }
    }
  }
}
```

### Output Files

| Format | Filename Pattern | Description |
|--------|-----------------|-------------|
| JSON | `results/<timestamp>-<preset>-<type>.json` | Full metadata, configuration, and per-run results |
| CSV | `results/<timestamp>-<preset>-<type>.csv` | Per-run data |
| CSV | `results/<timestamp>-<preset>-<type>-summary.csv` | Aggregated summary |
| HTML | `results/<timestamp>-<preset>-<type>.html` | Interactive report with charts |

## Docker Integration

The tool can automatically start a Kafka broker using Docker:

```bash
# Auto-start broker, run benchmarks, then stop
node index.js all --auto-broker --create-topics

# Keep broker running for manual inspection
node index.js producer --auto-broker --keep-broker
```

The `docker-compose.yml` file provides a single-node Kafka broker in KRaft mode (no ZooKeeper).

## Using from Root Project

```bash
# NPM scripts
npm run benchmark
npm run benchmark:producer
npm run benchmark:all
npm run benchmark:ci

# Make targets
make benchmark
make benchmark-producer
make benchmark-consumer
make benchmark-ci
```

## Architecture

```
tools/benchmark/
├── index.js                    # CLI entry point
├── docker-compose.yml          # Kafka broker for --auto-broker
├── run-all-presets.js          # Run all presets utility
├── combine-results.js          # Combine results utility
├── README.md                   # This documentation
├── lib/
│   ├── runner.js               # Multi-run orchestration
│   ├── statistics.js           # Statistical aggregation
│   ├── clients/
│   │   ├── base.js             # Abstract base class
│   │   ├── confluent-client.js # KafkaJS API wrapper
│   │   ├── rdkafka-client.js   # Raw rdkafka API
│   │   └── index.js            # Client factory
│   ├── config/
│   │   ├── preset-loader.js    # YAML preset loading
│   │   └── defaults.js         # Default values
│   ├── output/
│   │   ├── live-table.js       # Real-time progress table
│   │   ├── summary.js          # Aggregated summary
│   │   ├── json-writer.js      # JSON output
│   │   ├── csv-writer.js       # CSV output
│   │   ├── html-reporter.js    # HTML report with charts
│   │   └── combined-html-reporter.js  # Multi-preset comparison
│   └── utils/
│       ├── docker-broker.js    # Docker broker management
│       └── resource-monitor.js # CPU/memory tracking
└── presets/                    # YAML preset files
```

## Future: Centralized Benchmark Tool

For a unified benchmarking solution across all Confluent Kafka clients (JavaScript, Python, Java, Go, .NET), see the planning document for a centralized approach:

**Document**: [CENTRALIZED-BENCHMARK-PROPOSAL.md](CENTRALIZED-BENCHMARK-PROPOSAL.md)

This would enable:
- Cross-client performance comparisons
- Single maintenance point
- Consistent output formats
- Unified CI/CD integration
