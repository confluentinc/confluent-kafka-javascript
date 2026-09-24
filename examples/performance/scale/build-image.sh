#!/usr/bin/env bash
#
# Build and push the ckjs-perf-scale image from the Dockerfile in this
# directory. The Dockerfile clones confluent-kafka-javascript at a given ref
# and bakes in the native addon + performance example, so the build args
# (SOURCE_REPO / SOURCE_REF / NODE_VERSION) decide what ends up in the image.
#
# Point the chart at the result by setting image.repository / image.tag in
# values.yaml (or via scale.py --set) to match IMAGE / TAG below.
#
# Usage:
#   ./build-image.sh [options]
#
# Options (all also settable via env vars of the same upper-case name):
#   -i, --image <repo>      Image repository      (default: confluentinc/ckjs-perf-scale)
#   -t, --tag <tag>         Image tag             (default: ckjs-perf-scale)
#   -r, --ref <ref>         SOURCE_REF to build   (default: current git branch)
#       --repo <url>        SOURCE_REPO to clone  (default: the upstream GitHub repo)
#       --node-version <n>  NODE_VERSION base img (default: 22)
#       --platform <p>      docker --platform, e.g. linux/amd64, linux/arm64
#       --no-cache          Pass --no-cache to docker build (forces a fresh
#                           git clone of SOURCE_REF instead of a cached layer)
#       --no-push           Build only; skip docker push
#   -h, --help              Show this help and exit
#
# Examples:
#   ./build-image.sh --ref dev_performance_test_improvements_2
#   IMAGE=myreg.example.com/ckjs-perf-scale TAG=v3 ./build-image.sh
#   ./build-image.sh --platform linux/arm64 --tag arm64
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE="${IMAGE:-confluentinc/ckjs-perf-scale}"
TAG="${TAG:-ckjs-perf-scale}"
SOURCE_REPO="${SOURCE_REPO:-https://github.com/confluentinc/confluent-kafka-javascript.git}"
SOURCE_REF="${SOURCE_REF:-$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo master)}"
NODE_VERSION="${NODE_VERSION:-22}"
PLATFORM="${PLATFORM:-}"
PUSH=1
NO_CACHE=0

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; /^set -euo/d'; }

while [ $# -gt 0 ]; do
    case "$1" in
        -i|--image)        IMAGE="$2"; shift 2 ;;
        -t|--tag)          TAG="$2"; shift 2 ;;
        -r|--ref)          SOURCE_REF="$2"; shift 2 ;;
        --repo)            SOURCE_REPO="$2"; shift 2 ;;
        --node-version)    NODE_VERSION="$2"; shift 2 ;;
        --platform)        PLATFORM="$2"; shift 2 ;;
        --no-cache)        NO_CACHE=1; shift ;;
        --no-push)         PUSH=0; shift ;;
        -h|--help)         usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
done

IMAGE_REF="${IMAGE}:${TAG}"

build_args=(
    --build-arg "SOURCE_REPO=${SOURCE_REPO}"
    --build-arg "SOURCE_REF=${SOURCE_REF}"
    --build-arg "NODE_VERSION=${NODE_VERSION}"
)
[ -n "$PLATFORM" ] && build_args+=(--platform "$PLATFORM")
[ "$NO_CACHE" -eq 1 ] && build_args+=(--no-cache)

echo "Building ${IMAGE_REF}"
echo "  SOURCE_REPO=${SOURCE_REPO}"
echo "  SOURCE_REF=${SOURCE_REF}"
echo "  NODE_VERSION=${NODE_VERSION}"
[ -n "$PLATFORM" ] && echo "  platform=${PLATFORM}"

docker build "${build_args[@]}" \
    -t "${IMAGE_REF}" \
    -f "${SCRIPT_DIR}/Dockerfile" \
    "${SCRIPT_DIR}"

if [ "$PUSH" -eq 1 ]; then
    echo "Pushing ${IMAGE_REF}"
    docker push "${IMAGE_REF}"
else
    echo "Skipping push (--no-push). Built ${IMAGE_REF}."
fi
