#!/bin/sh
# This script is used to build the project within a docker image.
# The docker image is assumed to be an alpine docker image, for glibc based builds, we use
# the semaphhore agent directly.

apk add -U ca-certificates openssl ncurses coreutils python3 make gcc g++ libgcc linux-headers grep util-linux binutils findutils perl patch musl-dev bash

# s390x needs two adjustments; both are gated on the architecture so amd64/arm64 musl
# builds are unaffected.
NPM_CI_OMIT=""
if [ "$(uname -m)" = "s390x" ]; then
    # 1. librdkafka's bundled zlib fails to build with this image's gcc: its configure
    #    detects the vector extension by probing with -march=z13 and defines
    #    HAVE_S390X_VX, but then compiles contrib/crc32vx/crc32_vx.c without the flag,
    #    and alpine's gcc defaults to arch9 (no vector unit). It must be passed via CC,
    #    not CFLAGS, because mklove runs `CFLAGS=-fPIC ./configure` for its source deps
    #    and clobbers an inherited CFLAGS. musl also lacks glibc's HWCAP_S390_VX constant
    #    (renamed HWCAP_S390_VXRS), so alias it. z13 is a safe floor: RHEL 8/9 on s390x
    #    already require z14 or later.
    export CC="gcc -march=z13 -DHWCAP_S390_VX=HWCAP_S390_VXRS"
    export CXX="g++ -march=z13 -DHWCAP_S390_VX=HWCAP_S390_VXRS"
    # 2. The @bufbuild/buf devDependency ships no s390x binary and fails its postinstall.
    #    It is protobuf codegen tooling, not needed to build the addon, so skip devDeps.
    NPM_CI_OMIT="--omit=dev"
fi

# /v is the volume mount point for the project root
cd /v
npm --userconfig /.npmrc ci $NPM_CI_OMIT
npx node-pre-gyp package
