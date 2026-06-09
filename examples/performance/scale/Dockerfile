# Prebuilt image for the ckjs-perf-scale Helm chart.
#
# Bakes a specific confluent-kafka-javascript ref into the image: installs the
# build deps, builds the native @confluentinc/kafka-javascript addon from
# source (dynamic linking), and installs the performance example deps. The
# chart's producer / create-topics Jobs then just run `node` against this
# image, so there is no per-pod apt/git/nvm/npm work at pod startup.
#
# The repo/ref that used to be cloned at runtime by the init container
# (source.repo / source.ref) are now Docker build args baked in here.
#
# Build (from the repo root or anywhere — the context is unused, the source is
# cloned from git):
#
#   docker build \
#     --build-arg SOURCE_REF=dev_performance_test_improvements_2 \
#     -t <registry>/ckjs-perf-scale:<tag> \
#     -f examples/performance/scale/Dockerfile \
#     examples/performance/scale
#
#   docker push <registry>/ckjs-perf-scale:<tag>
#
# Then set image.repository / image.tag in values.yaml to match.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm

ARG SOURCE_REPO=https://github.com/confluentinc/confluent-kafka-javascript.git
ARG SOURCE_REF=master

ENV DEBIAN_FRONTEND=noninteractive

# Build deps for the librdkafka source build. The -dev packages pull in the
# matching runtime libs (libssl3, libcurl4, zlib1g, libsasl2-2, libzstd1) that
# the dynamically linked addon needs at run time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential python3 git ca-certificates \
      libssl-dev libcurl4-openssl-dev zlib1g-dev libsasl2-dev libzstd-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone "$SOURCE_REPO" ckjs \
 && cd ckjs \
 && git checkout "$SOURCE_REF" \
 && git submodule update --init --recursive

WORKDIR /opt/ckjs
RUN CKJS_LINKING=dynamic npm install --build-from-source=@confluentinc/kafka-javascript

WORKDIR /opt/ckjs/examples/performance
# The committed package-lock.json pins kafkajs to Confluent's private
# CodeArtifact registry (auth-required, unreachable in this build). The only
# external dep is the public kafkajs, so resolve fresh against public npm.
RUN rm -f package-lock.json \
 && npm install --registry=https://registry.npmjs.org/

CMD ["node", "performance-consolidated.js", "--producer"]
