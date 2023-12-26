#!/bin/sh

apk add -U ca-certificates openssl ncurses coreutils python3 make gcc g++ libgcc linux-headers grep util-linux binutils findutils perl patch musl-dev bash
cd /v
npm install
npx node-pre-gyp package