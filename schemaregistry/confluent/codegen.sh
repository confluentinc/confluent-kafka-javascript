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

# The old module exported the Decimal message type and its schema as well as the descriptor, and
# protoc-gen-es emits no symbol re-exports for a public import - only the descriptor constant. So
# they are appended, keeping a deep import of the old module resolving. The Go and Python clients
# preserve the same two names at their own old paths (a Go type alias, Python's `import *`), and
# without this JavaScript would be the only one of the three to drop them.
cat >> schemaregistry/confluent/types/decimal_pb.ts <<'TS'

// Deprecated: import these from the package root, or from confluent/type/decimal_pb. Appended by
// codegen.sh - see the note there.
export type { Decimal } from "../type/decimal_pb";
export { DecimalSchema } from "../type/decimal_pb";
TS
