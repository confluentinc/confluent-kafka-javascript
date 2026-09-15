#!/usr/bin/env bash
# Regenerates the TypeScript lexer/parser from grammar/LogicalTypes.g4 via
# antlr-ng (ANTLR 4.13.x-compatible, matching the version schema-registry's
# Java build pins). Output is committed, so this only needs to be re-run when
# the vendored grammar/LogicalTypes.g4 changes.
#
# To pick up a change made in schema-registry, first re-copy the grammar:
#   cp ../../../schema-registry/logical-types/src/main/antlr4/io/confluent/kafka/schemaregistry/type/logical/generated/LogicalTypes.g4 grammar/LogicalTypes.g4
# then run this script.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf src/generated
mkdir -p src/generated

npx antlr-ng --generate-visitor --generate-listener false -D language=TypeScript -o src/generated grammar/LogicalTypes.g4

echo "Generated parser written to src/generated/"
