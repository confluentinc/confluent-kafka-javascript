# Makefile.schemaregistry

# Variables
NODE ?= node
ESLINT ?= ../node_modules/.bin/eslint
JEST ?= ../node_modules/.bin/jest
TS_NODE ?= ../node_modules/.bin/ts-node
DOCKER ?= ./run_docker_schemaregistry.sh

# Paths
SRC_DIR = .
SR_TEST_DIR = ./schemaregistry/test
INTEG_DIR = ../e2e/schemaregistry

# Tasks
.PHONY: all lint test integtest

all: lint test

lint:
	$(ESLINT) $(SRC_DIR) $(TEST_DIR) $(INTEG_DIR) $(DEK_TEST_DIR)

test:
	$(JEST) $(SR_TEST_DIR)

integtest:
	$(DOCKER)
