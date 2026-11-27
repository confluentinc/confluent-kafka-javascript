#!/bin/sh
set -e

# A plain alpine image has no Node. It is used for Node 26 on s390x, which has
# no node:26-alpine image; Node then comes from Alpine's own package.
if ! command -v node > /dev/null 2>&1; then
    apk add -U nodejs-current npm
fi

. /v/ci/post-install/_install_ckjs.sh
