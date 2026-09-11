# ckjs-perf-scale — multi-pod producer/consumer scale tests

A Helm chart + Python driver that runs
`examples/performance/performance-consolidated.js --producer` on N pods
in parallel and aggregates the per-pod MB/s throughput into a single
average and aggregate figure.

When the values file includes a `consumer:` section, a second Job runs
`performance-consolidated.js --consumer` on its own set of pods in parallel
with the producer Job. The consumer pods' logs are collected separately into
`scale-<release>-consumer.log` (see Running below). Omit the `consumer:`
section for a producer-only run.

The pods are not built into a prebuilt image: each pod runs an
`initContainer` on `ubuntu:24.04` that follows the same prereq commands
documented in the repo (apt install, git clone, nvm + Node LTS, `npm install`)
into a shared `emptyDir`. The producer container then runs the script
against that workspace.

## Layout

```
examples/performance/scale/
├── Chart.yaml
├── values.yaml                  # defaults: producer + optional consumer sections
├── example-values.yaml          # sample override file for scale.py
├── templates/
│   ├── _helpers.tpl
│   ├── configmap.yaml           # non-secret env vars (producer + consumer)
│   ├── producer-config.yaml     # extra librdkafka producer + consumer config
│   ├── secret.yaml              # SASL_PASSWORD
│   ├── create-topics-job.yaml   # pre-install hook Job, runs --create-topics once
│   ├── producer-job.yaml        # producer Job, parallelism = producer.replicas
│   └── consumer-job.yaml        # consumer Job (only when consumer: is set)
└── scale.py                     # driver: install, wait, collect logs, average
```

## Requirements

- A reachable Kubernetes cluster (`kubectl` configured) with internet egress
  (pods need to `git clone` from GitHub and `apt install`).
- `helm` v3 and `kubectl` on the host running `scale.py`.
- Python 3.8+ (standard library only).

## Configuration

All knobs live in `values.yaml`. The most important ones:

| Key | Default | Description |
|-----|---------|-------------|
| `producer.replicas` | `4` | Number of producer pods (producer Job parallelism & completions). |
| `consumer.replicas` | — | Number of consumer pods. Only used when a `consumer:` section is present. |
| `createTopics` | `true` | Runs a single pre-install hook Job with `--create-topics` before the producer Job. Set false to skip topic setup. |
| `source.repo` | confluent-kafka-javascript on GitHub | Repo baked into the prebuilt image. |
| `source.ref` | `dev_performance_test_improvements_2` | Branch/tag/SHA the image was built from. |
| `image.repository` / `image.tag` | prebuilt ckjs-perf-scale image | Image used for both containers. |
| `kafka.brokers`, `kafka.securityProtocol`, `kafka.saslUsername`, `kafka.saslPassword`, `kafka.topic`, `kafka.topic2` | — | Connectivity / auth. `saslPassword` is required. `topic2` is only needed when `consumer.produceToSecondTopic` is true. |
| `producer.*` | match the reference command line | Producer Job env vars: `MODE`, `MESSAGE_COUNT`, `MESSAGE_SIZE`, `PRODUCER_BATCH_SIZE` (`batchSize`), `COMPRESSION`, `PARTITIONS`, `TERMINATE_TIMEOUT_MS`, `INITIAL_DELAY_MS` (`initialDelayMs`), `LIMIT_RPS` (`limitRPS`), `USE_CKJS_PRODUCER_EVERYWHERE`, `IS_HIGHER_LATENCY_CLUSTER`, `USE_KEYS`, `STATISTICS_INTERVAL_MS`. `producer.config` is a list of extra librdkafka producer properties. |
| `consumer.*` | optional section | Consumer Job env vars: `MODE`, `TERMINATE_TIMEOUT_MS`, `PARTITIONS_CONSUMED_CONCURRENTLY`, `AUTO_COMMIT`, `CONSUMER_MODE`, `CONSUMER_MAX_BATCH_SIZE`, `AUTO_COMMIT_ON_BATCH_END`, `USE_CKJS_PRODUCER_EVERYWHERE`, `IS_HIGHER_LATENCY_CLUSTER`, `STATISTICS_INTERVAL_MS`, plus `produceToSecondTopic` (passed as the `--produce-to-second-topic` flag). The workload-shape values (`MESSAGE_COUNT`, `MESSAGE_SIZE`, `COMPRESSION`, `LIMIT_RPS`) are taken from the `producer` section so the consumer matches the produced load. `consumer.config` is a list of extra librdkafka consumer properties (read via `CONSUMER_CONFIG_FILE`). |

Override anything by passing a file to `scale.py`; see
`example-values.yaml`.

## Running

```bash
# 1. Copy the example, fill in saslPassword.
cp examples/performance/scale/example-values.yaml my-values.yaml
$EDITOR my-values.yaml

# 2. Drive the run.
python3 examples/performance/scale/scale.py my-values.yaml \
    --namespace default \
    --release ckjs-perf-scale \
    --log ./perf-scale.log

# Override the branch without editing the values file:
python3 examples/performance/scale/scale.py my-values.yaml \
    --ref my-feature-branch
```

What `scale.py` does:

1. `helm upgrade --install perf-scale ./examples/performance/scale -f my-values.yaml -n perf-test --create-namespace --wait --wait-for-jobs --timeout 3600s`. The `--wait-for-jobs` flag blocks until both the create-topics hook Job and the producer Job complete (or fail).
2. Lists the pods of the producer Job and `kubectl logs` each one into the output log file under a `===== POD <name> =====` banner.
3. Parses the last `=== Producer Rate:  <number>` line from each pod (MB/s — confirmed at `examples/performance/performance-primitives-common.js:519`).
4. Appends a `===== SUMMARY =====` block:

   ```
   pods: 4
   per-pod MB/s: 12.31, 12.04, 11.98, 12.42
   average MB/s: 12.19
   aggregate MB/s: 48.75
   ```

5. If a consumer Job exists, repeats the wait/collect/copy steps for the
   consumer pods, writing their console logs and copied log files into a
   separate `scale-<release>-consumer.log` in the same run folder (no
   throughput summary — consumer rates are in the per-pod logs).
6. `helm uninstall` the release (skip with `--keep`).

Exit code 0 iff every producer pod reported a Producer Rate.

## Notes / caveats

- The chart clones the repo from GitHub. Local working-tree edits (including
  submodule modifications under `deps/librdkafka`) are **not** picked up
  unless they are committed and pushed to `source.ref`.
- The init container takes ~2–4 minutes per pod (`apt install` + `git clone`
  + `npm install` with a source build of librdkafka). This dominates the
  pod start-up; the actual producer run starts only after it completes.
- Both containers re-`apt update && apt install` runtime libs in the
  producer container (`libssl3`, `libcurl4`, `zlib1g`, `libsasl2-2`,
  `libzstd1`) — same image, separate filesystems.
- `KAFKA_TOPIC` is the same on every pod by design (all pods produce to
  one topic, sharing load). The pre-install Job runs `--create-topics`
  once so the N producers don't race on delete+recreate.
