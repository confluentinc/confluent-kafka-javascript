# ckjs-perf-scale — multi-pod producer scale tests

A Helm chart + Python driver that runs
`examples/performance/performance-consolidated.js --producer` on N pods
in parallel and aggregates the per-pod MB/s throughput into a single
average and aggregate figure.

The pods are not built into a prebuilt image: each pod runs an
`initContainer` on `ubuntu:24.04` that follows the same prereq commands
documented in the repo (apt install, git clone, nvm + Node LTS, `npm install`)
into a shared `emptyDir`. The producer container then runs the script
against that workspace.

## Layout

```
examples/performance/scale/
├── Chart.yaml
├── values.yaml                  # defaults + every env var of the producer
├── example-values.yaml          # sample override file for scale.py
├── templates/
│   ├── _helpers.tpl
│   ├── configmap.yaml           # non-secret env vars
│   ├── secret.yaml              # SASL_PASSWORD
│   ├── create-topics-job.yaml   # pre-install hook Job, runs --create-topics once
│   └── producer-job.yaml        # main Job, parallelism = replicaCount
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
| `replicaCount` | `4` | Number of producer pods (Job parallelism & completions). |
| `createTopics` | `true` | Runs a single pre-install hook Job with `--create-topics` before the producer Job. Set false to skip topic setup. |
| `source.repo` | confluent-kafka-javascript on GitHub | Repo cloned by the init container. |
| `source.ref` | `dev_performance_test_improvements_2` | Branch/tag/SHA to check out. |
| `image.repository` / `image.tag` | `ubuntu` / `24.04` | Base image used for both containers. |
| `kafka.brokers`, `kafka.securityProtocol`, `kafka.saslUsername`, `kafka.saslPassword`, `kafka.topic` | — | Connectivity / auth. `saslPassword` is required. |
| `producer.*` | match the reference command line | One key per env var the script reads (`MESSAGE_COUNT`, `MESSAGE_SIZE`, `PRODUCER_BATCH_SIZE`, `COMPRESSION`, `PARTITIONS`, `PARTITIONS_CONSUMED_CONCURRENTLY`, `TERMINATE_TIMEOUT_MS`, `PRODUCE_TO_SECOND_TOPIC`, `AUTO_COMMIT`, `CONCURRENT_RUN`, `CONSUMER_MODE`, `CONSUMER_MAX_BATCH_SIZE`, `USE_CKJS_PRODUCER_EVERYWHERE`, `AUTO_COMMIT_ON_BATCH_END`, `IS_HIGHER_LATENCY_CLUSTER`, `USE_KEYS`, `SKIP_CTP_TEST`, `MODE`). |

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

5. `helm uninstall` the release (skip with `--keep`).

Exit code 0 iff every pod reported a Producer Rate.

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
