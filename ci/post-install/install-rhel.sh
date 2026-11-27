#!/bin/sh
set -e

pwd

# libatomic: the Node 26 binary links against it and minimal images lack it.
dnf install --allowerasing -y bash curl libatomic

. /v/ci/post-install/_install_nvm.sh
. /v/ci/post-install/_install_ckjs.sh