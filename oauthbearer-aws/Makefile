# Makefile.oauthbearer-aws
#
# Run from the workspace directory (e.g. `make -C oauthbearer-aws test`)
# or from inside the directory (`cd oauthbearer-aws && make test`).

ESLINT ?= ../node_modules/.bin/eslint
JEST   ?= ../node_modules/.bin/jest

SRC_DIR  = .
TEST_DIR = ./test
E2E_DIR  = ./e2e

.PHONY: all lint test e2e build

all: lint test

lint:
	$(ESLINT) $(SRC_DIR) $(TEST_DIR) $(E2E_DIR)

test:
	$(JEST) $(TEST_DIR)

# Real-AWS integration tests. Gated by RUN_AWS_STS_REAL=1 inside the test files.
# Pass extra env vars (AWS_REGION, AUDIENCE) on the command line.
#
# NODE_OPTIONS=--experimental-vm-modules is required because the AWS SDK's
# @aws-sdk/credential-provider-node uses dynamic ESM `import()` internally,
# which jest's CJS VM rejects without this flag.
e2e:
	RUN_AWS_STS_REAL=1 NODE_OPTIONS='--experimental-vm-modules' \
		$(JEST) --config ./e2e/jest.config.js

build:
	rm -rf ./dist && tsc -p tsconfig-build.json
