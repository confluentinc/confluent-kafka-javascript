#!/bin/sh
# This script is used to build the glibc addon for Node 26 and later within an
# almalinux:8 docker image, on amd64, arm64 and s390x.
#
# Node 26's V8 headers include C++20 library headers such as <source_location>, which
# the gcc 10 in node:*-bullseye (and in the ubuntu:20.04 image build-docker-s390x.sh
# uses) does not have, so the addon no longer compiles there. AlmaLinux 8 has a newer
# gcc in gcc-toolset, and is glibc 2.28, below the 2.31 floor of the other glibc
# artifacts. gcc-toolset links whatever it needs beyond the system libstdc++ into the
# binary statically, so the addon only depends on the libstdc++ AlmaLinux 8 ships.
# Node's own Linux binaries are built the same way.
#
# NODE_VERSION is either a major version, in which case the latest release of that line
# is used (as the node:${NODE_VERSION}-bullseye images do), or an exact version.

set -e

if [ -z "$NODE_VERSION" ]; then
    echo "NODE_VERSION not defined"
    exit 1
fi

# perl and patch are needed because librdkafka's mklove builds libcrypto and libcurl
# from source, and mklove locates tools with which. libatomic is needed by the Node 26
# binary, and node-gyp needs Python 3.8 or later (the default python3 here is 3.6).
dnf install -y gcc-toolset-13-gcc gcc-toolset-13-gcc-c++ make python3.11 perl perl-IPC-Cmd \
    libatomic patch xz tar findutils diffutils which
. /opt/rh/gcc-toolset-13/enable
export PYTHON=/usr/bin/python3.11

case "$(uname -m)" in
    x86_64) NODE_ARCH=x64 ;;
    aarch64) NODE_ARCH=arm64 ;;
    *) NODE_ARCH=$(uname -m) ;;
esac

case "$NODE_VERSION" in
    *.*) NODE_DIST="https://nodejs.org/dist/v${NODE_VERSION}" ;;
    *) NODE_DIST="https://nodejs.org/dist/latest-v${NODE_VERSION}.x" ;;
esac

# Download the Node tarball and verify it against the official published SHA-256 sum
# before extracting, as build-docker-s390x.sh does.
cd /tmp
curl --proto '=https' -fsSL "${NODE_DIST}/SHASUMS256.txt" -o SHASUMS256.txt
NODE_TARBALL=$(grep -o "node-v[0-9.]*-linux-${NODE_ARCH}\.tar\.xz" SHASUMS256.txt)
curl --proto '=https' -fsSLO "${NODE_DIST}/${NODE_TARBALL}"
grep " ${NODE_TARBALL}\$" SHASUMS256.txt | sha256sum -c -
tar xJf "${NODE_TARBALL}" -C /opt
export PATH="/opt/${NODE_TARBALL%.tar.xz}/bin:$PATH"

# /v is the volume mount point for the project root
cd /v
if [ "$(uname -m)" = "s390x" ]; then
    # Same two s390x adjustments as build-docker-s390x.sh: zlib's vector code needs
    # -march=z13 on CC, and the @bufbuild/buf devDependency has no s390x binary.
    export CC="gcc -march=z13"
    export CXX="g++ -march=z13"
    npm --userconfig /.npmrc ci --omit=dev
else
    npm --userconfig /.npmrc ci
fi
npx node-pre-gyp package
