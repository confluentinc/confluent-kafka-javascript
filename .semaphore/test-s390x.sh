#!/bin/bash
# This script builds the client from source and runs one of the CI test jobs on s390x
# (IBM Z), inside an ubuntu:24.04 container on the native s390x agent.
#
# It mirrors the amd64/arm64 test jobs, with three differences forced by the architecture:
#
# - Node comes from the official nodejs.org tarball: the agent has no Node.js, and Node
#   stopped publishing s390x Debian images at v22.
# - The @bufbuild/buf devDependency ships no s390x binary and its postinstall fails, so
#   `npm ci` runs with --ignore-scripts. protobufjs is the only other dependency with an
#   install script, so it is rebuilt explicitly, and the addon is then built from source
#   the same way `npm run install-from-source` does.
# - The images the other jobs start with docker compose (cp-zookeeper/cp-kafka 7.9.2,
#   apache/kafka 4.0.0, cp-schema-registry 7.6.0) have no s390x variant, so the same
#   versions run from Confluent Platform release tarballs on Java 17, configured like the
#   compose files. Kafka 4.0 comes from Confluent Platform 8.0.0, which is built on it:
#   archive.apache.org, the only host still serving the Apache 4.0.0 tarball, is throttled
#   to a few hundred KB/s and would add about ten minutes to the job.
#
# Usage: test-s390x.sh test|promisified-classic|promisified-consumer|sr-test|sr-e2e

set -euo pipefail

JOB=${1:?usage: test-s390x.sh <job>}
if [ -z "${NODE_VERSION:-}" ]; then
    echo "NODE_VERSION not defined"
    exit 1
fi

needs_broker() { [ "$JOB" != test ] && [ "$JOB" != sr-test ]; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
# CKJS_LINKING=dynamic (as in the other test jobs) links librdkafka against the system
# libraries, so their -dev packages are needed.
apt-get install -y build-essential python3 perl patch pkg-config curl ca-certificates xz-utils \
    libssl-dev libsasl2-dev libzstd-dev liblz4-dev zlib1g-dev libcurl4-openssl-dev
if needs_broker; then
    apt-get install -y openjdk-17-jre-headless
fi

# Download the Node tarball and verify it against the official published SHA-256 sum
# before extracting. --proto '=https' keeps both downloads, including redirects, on HTTPS.
NODE_DIST="https://nodejs.org/dist/v${NODE_VERSION}"
NODE_TARBALL="node-v${NODE_VERSION}-linux-s390x.tar.xz"
cd /tmp
curl --proto '=https' -fsSLO "${NODE_DIST}/${NODE_TARBALL}"
curl --proto '=https' -fsSL "${NODE_DIST}/SHASUMS256.txt" | grep " ${NODE_TARBALL}\$" | sha256sum -c -
tar xJf "${NODE_TARBALL}" -C /opt
export PATH="/opt/node-v${NODE_VERSION}-linux-s390x/bin:$PATH"

# /v is the volume mount point for the project root
cd /v
export CKJS_LINKING=dynamic
npm --userconfig /.npmrc ci --ignore-scripts
npm rebuild protobufjs
npx node-pre-gyp install --build-from-source=@confluentinc/kafka-javascript --fallback-to-build
# The Makefile's test targets depend on node_modules/.dirstamp and would otherwise run
# `npm ci` again, with install scripts.
touch node_modules/.dirstamp

BROKERS=/opt/brokers
CP79="$BROKERS/confluent-7.9.2"
CP76="$BROKERS/confluent-7.6.0"
CP80="$BROKERS/confluent-8.0.0"
DATA=/tmp/brokers

fetch_confluent() {  # <minor> <version>
    curl --proto '=https' -fsSL "https://packages.confluent.io/archive/$1/confluent-community-$2.tar.gz" |
        tar xz -C "$BROKERS"
}

wait_for_kafka() {  # <kafka-broker-api-versions tool>
    local i
    for i in $(seq 1 90); do
        if "$1" --bootstrap-server localhost:9092 > /dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    echo "Kafka did not become ready"
    exit 1
}

start_zookeeper() {
    mkdir -p "$DATA/zookeeper"
    cat > "$DATA/zookeeper.properties" <<EOF
dataDir=$DATA/zookeeper
clientPort=2181
maxClientCnxns=0
admin.enableServer=false
EOF
    LOG_DIR="$DATA/logs/zookeeper" "$CP79/bin/zookeeper-server-start" -daemon "$DATA/zookeeper.properties"
}

# Same settings as the kafka service in test/docker/docker-compose.yml
start_classic() {
    start_zookeeper
    cat > "$DATA/kafka.properties" <<EOF
broker.id=0
listener.security.protocol.map=PLAINTEXT_HOST:PLAINTEXT
listeners=PLAINTEXT_HOST://0.0.0.0:9092
advertised.listeners=PLAINTEXT_HOST://localhost:9092
inter.broker.listener.name=PLAINTEXT_HOST
sasl.enabled.mechanisms=PLAIN
zookeeper.connect=localhost:2181
zookeeper.connection.timeout.ms=18000
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
log.dirs=$DATA/kafka
EOF
    LOG_DIR="$DATA/logs/kafka" "$CP79/bin/kafka-server-start" -daemon "$DATA/kafka.properties"
    wait_for_kafka "$CP79/bin/kafka-broker-api-versions"
}

# test/docker/kraft/server.properties, unchanged except for addressing: the compose file
# maps host ports 9092/9093 to the container's DOCKER listeners and names the host
# "kafka"; here the PLAINTEXT and SASL_PLAINTEXT listeners serve localhost directly.
start_kraft() {
    sed -e 's#^listeners=.*#listeners=PLAINTEXT://:9092,CONTROLLER://:38705,SASL_PLAINTEXT://:9093#' \
        -e 's#^advertised.listeners=.*#advertised.listeners=PLAINTEXT://localhost:9092,SASL_PLAINTEXT://localhost:9093#' \
        -e 's#^controller.quorum.voters=.*#controller.quorum.voters=0@localhost:38705#' \
        /v/test/docker/kraft/server.properties > "$DATA/kraft.properties"
    printf '\nnode.id=0\nlog.dirs=%s\n' "$DATA/kraft" >> "$DATA/kraft.properties"
    "$CP80/bin/kafka-storage" format -t "$("$CP80/bin/kafka-storage" random-uuid)" -c "$DATA/kraft.properties"
    KAFKA_OPTS="-Djava.security.auth.login.config=/v/test/docker/kafka_jaas.conf" LOG_DIR="$DATA/logs/kafka" \
        "$CP80/bin/kafka-server-start" -daemon "$DATA/kraft.properties"
    wait_for_kafka "$CP80/bin/kafka-broker-api-versions"
}

# Same settings as schemaregistry/docker-compose.schemaregistry.yml
start_schema_registry_stack() {
    start_zookeeper
    cat > "$DATA/kafka.properties" <<EOF
broker.id=0
listener.security.protocol.map=PLAINTEXT_INTERNAL:PLAINTEXT,PLAINTEXT_EXTERNAL:PLAINTEXT
listeners=PLAINTEXT_INTERNAL://0.0.0.0:9093,PLAINTEXT_EXTERNAL://0.0.0.0:9092
advertised.listeners=PLAINTEXT_INTERNAL://localhost:9093,PLAINTEXT_EXTERNAL://localhost:9092
inter.broker.listener.name=PLAINTEXT_INTERNAL
zookeeper.connect=localhost:2181
zookeeper.connection.timeout.ms=18000
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
log.dirs=$DATA/kafka
EOF
    LOG_DIR="$DATA/logs/kafka" "$CP79/bin/kafka-server-start" -daemon "$DATA/kafka.properties"
    wait_for_kafka "$CP79/bin/kafka-broker-api-versions"
    cat > "$DATA/schema-registry.properties" <<EOF
listeners=http://0.0.0.0:8081
kafkastore.bootstrap.servers=PLAINTEXT://localhost:9093
host.name=localhost
EOF
    LOG_DIR="$DATA/logs/schema-registry" "$CP76/bin/schema-registry-start" -daemon "$DATA/schema-registry.properties"
    local i
    for i in $(seq 1 90); do
        if curl -sf http://localhost:8081/subjects > /dev/null; then
            return 0
        fi
        sleep 2
    done
    echo "Schema Registry did not become ready"
    exit 1
}

show_broker_logs() {
    local rc=$?
    if [ "$rc" -ne 0 ] && [ -d "$DATA/logs" ]; then
        echo "---- last broker log lines (exit code $rc) ----"
        tail -n 40 "$DATA"/logs/*/*.log 2>/dev/null || true
    fi
}

if needs_broker; then
    mkdir -p "$BROKERS" "$DATA"
    trap show_broker_logs EXIT
fi

case "$JOB" in
    test)
        make test
        ;;
    promisified-classic)
        fetch_confluent 7.9 7.9.2
        start_classic
        sleep 30
        NODE_OPTIONS='--max-old-space-size=1536' npx jest --no-colors --ci test/promisified/
        ;;
    promisified-consumer)
        fetch_confluent 8.0 8.0.0
        start_kraft
        sleep 30
        TEST_CONSUMER_GROUP_PROTOCOL=consumer NODE_OPTIONS='--max-old-space-size=1536' \
            npx jest --no-colors --ci test/promisified/
        ;;
    sr-test)
        cd schemaregistry
        #TODO: Understand why first run fails (same retry as the amd64 job)
        npm run test || npm run test || npm run test
        ;;
    sr-e2e)
        fetch_confluent 7.9 7.9.2
        fetch_confluent 7.6 7.6.0
        start_schema_registry_stack
        sleep 10
        cd schemaregistry
        ../node_modules/.bin/jest ./e2e/schemaregistry
        ;;
    *)
        echo "unknown job: $JOB"
        exit 1
        ;;
esac
