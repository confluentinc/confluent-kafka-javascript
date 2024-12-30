#!/bin/sh
set -e

library_version="$2"

# Only for logging purposes
node -v
uname -m

installDir=$(mktemp -d)
cd $installDir
npm init -y

# uncomment for one final run.
echo npm install @confluentinc/kafka-javascript@${library_version} --save

# node -e 'console.log(require("@confluentinc/kafka-javascript").librdkafkaVersion);'
