#!/bin/sh
set -e

apk add -U bash curl

node_version="$1"
library_version="$2"

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm install $node_version

# Only for logging purposes
node -v
uname -m

installDir=$(mktemp -d)
cd $installDir
npm init -y

# uncomment for one final run.
echo npm install @confluentinc/kafka-javascript@${library_version} --save

# node -e 'console.log(require("@confluentinc/kafka-javascript").librdkafkaVersion);'
