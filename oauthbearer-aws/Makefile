# Makefile.oauthbearer-aws

# Variables
NODE ?= node
ESLINT ?= ../node_modules/.bin/eslint
JEST ?= ../node_modules/.bin/jest

# Paths
SRC_DIR = .
TEST_DIR = ./test
E2E_DIR = ./e2e

# Tasks
.PHONY: all lint test e2e

all: lint test

lint:
	$(ESLINT) $(SRC_DIR)

test:
	$(JEST) $(TEST_DIR)

e2e:
	RUN_AWS_STS_REAL=1 $(JEST) --config $(E2E_DIR)/jest.config.js
