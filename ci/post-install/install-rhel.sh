#!/bin/sh
set -e

pwd

dnf install --allowerasing -y bash curl libatomic

. /v/ci/post-install/_install_nvm.sh
. /v/ci/post-install/_install_ckjs.sh