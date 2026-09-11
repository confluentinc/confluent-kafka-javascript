#!/usr/bin/env bash
# Regenerates the TypeScript bindings for the vendored confluent value types.
# Run from the repo root. Requires protoc and the protoc-gen-es in node_modules.
#
# Deliberately narrow, and deliberately not `buf generate`: buf.gen.yaml points at the whole
# proto/ directory, and running it also rewrites confluent/meta_pb.ts and the tink protos from
# protoc-gen-es v2.2.3 to the current version (codegenv1 -> codegenv2), and writes the test
# protos to schemaregistry/test/schemaregistry/... rather than the schemaregistry/test/serde/test
# location they are checked in at. Regenerate those on purpose, not as a side effect of touching
# the value types.
#
# confluent/types/decimal.proto is a public-import stub for the path confluent.type.Decimal
# occupied before it moved here. protoc-gen-es names the descriptor constant after the source
# path, so the stub is what keeps `file_confluent_types_decimal` - a root export before the move
# - in existence; index.ts re-exports it as deprecated.
set -euo pipefail

export PATH="$PWD/node_modules/.bin:$PATH"

protoc -Iproto --es_out=schemaregistry --es_opt=target=ts \
  confluent/type/decimal.proto \
  confluent/type/variant.proto \
  confluent/types/decimal.proto
