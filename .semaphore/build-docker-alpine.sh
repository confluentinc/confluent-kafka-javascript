#!/bin/sh
# This script is used to build the project within a docker image.
# The docker image is assumed to be an alpine docker image, for glibc based builds, we use
# the semaphhore agent directly.

apk add -U ca-certificates openssl ncurses coreutils python3 make gcc g++ libgcc linux-headers grep util-linux binutils findutils perl patch musl-dev bash

# On s390x, librdkafka's bundled zlib fails to build with this image's gcc: its configure
# detects the vector extension by probing with -march=z13 and defines HAVE_S390X_VX, but
# then compiles contrib/crc32vx/crc32_vx.c without the flag, and alpine's gcc defaults to
# arch9 (no vector unit). It must be passed via CC, not CFLAGS, because mklove runs
# `CFLAGS=-fPIC ./configure` for its source deps and clobbers an inherited CFLAGS. musl
# also lacks glibc's HWCAP_S390_VX constant (renamed HWCAP_S390_VXRS), so alias it.
# z13 is a safe floor: RHEL 8/9 on s390x already require z14 or later.
if [ "$(uname -m)" = "s390x" ]; then
    export CC="gcc -march=z13 -DHWCAP_S390_VX=HWCAP_S390_VXRS"
    export CXX="g++ -march=z13 -DHWCAP_S390_VX=HWCAP_S390_VXRS"
fi

# /v is the volume mount point for the project root
cd /v
npm --userconfig /.npmrc ci
npx node-pre-gyp package
