#!/bin/sh
# This script is used to build the project within a docker image, on s390x (IBM Z).
#
# The other glibc targets build in node:${NODE_VERSION}-bullseye, but Node stopped
# publishing s390x Debian images at v22, so there is no single node:* image covering
# the release ABI matrix on this architecture. We use ubuntu:20.04 instead and install
# Node from the official nodejs.org tarball, which does ship linux-s390x for every
# version we release for. Ubuntu 20.04 is glibc 2.31 — the same floor as bullseye — so
# the resulting addon has the same reach as the other glibc artifacts.
#
# The container is needed even though the agent is itself s390x: the agent runs Ubuntu
# 24.04 (glibc 2.39), which would raise the floor far above what the other platforms
# ship. The agent also has no Node.js installed, which does not matter here since Node
# comes from the tarball inside the container.

set -e

if [ -z "$NODE_VERSION" ]; then
    echo "NODE_VERSION not defined"
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
# perl and patch are needed because librdkafka's mklove builds libcrypto and libcurl
# from source; gcc-10 matches the compiler the bullseye-based targets use.
apt-get install -y build-essential gcc-10 g++-10 perl patch wget curl xz-utils python3 \
    ca-certificates file binutils
update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-10 100 \
    --slave /usr/bin/g++ g++ /usr/bin/g++-10

curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-s390x.tar.xz" \
    | tar xJ -C /opt
export PATH="/opt/node-v${NODE_VERSION}-linux-s390x/bin:$PATH"

# zlib's configure probes for the s390x vector extension using -march=z13, gets a "yes",
# and defines HAVE_S390X_VX — but then compiles contrib/crc32vx/crc32_vx.c without the
# flag, so the vector builtins fail to compile wherever gcc's default -march predates
# z13 (it is arch10/zEC12 here). The flag has to ride on CC rather than CFLAGS, because
# mklove invokes `CFLAGS=-fPIC ./configure` for its source-built dependencies and that
# clobbers any inherited CFLAGS. z13 is a safe floor: RHEL 8 and 9 on s390x already
# require z14 or later.
export CC="gcc -march=z13"
export CXX="g++ -march=z13"

# /v is the volume mount point for the project root
cd /v
# --omit=dev: the @bufbuild/buf devDependency ships no s390x binary and fails its
# postinstall. It is a protobuf codegen tool, not needed to build or run the client.
npm --userconfig /.npmrc ci --omit=dev
npx node-pre-gyp package
