#!/bin/sh
set -e

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

apt update
apt install -y bash curl

node_version="$1"

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

# npm install @confluentinc/kafka-javascript --save

# node -e 'console.log(require("@confluentinc/kafka-javascript").librdkafkaVersion);'
