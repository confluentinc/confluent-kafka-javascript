/**
 * The compatibility surface for the path confluent.type.Decimal occupied before it moved to its
 * canonical confluent/type/... location.
 *
 * protoc-gen-es names the descriptor constant after the source path, so the move renamed a
 * *root export*: `file_confluent_types_decimal` became `file_confluent_type_decimal`, and
 * anything importing the old name from the package root stopped compiling. The old path is a
 * public-import stub now, which regenerates that constant. Nothing inside the client uses it, so
 * without these assertions it could disappear again unnoticed.
 */
import { describe, expect, it } from '@jest/globals'
import { createFileRegistry } from '@bufbuild/protobuf'
import { file_confluent_types_decimal, file_confluent_type_decimal } from '../../../index'
// Imported from the old module path on purpose - that deep import is what these assert.
import {
  file_confluent_types_decimal as legacyFile,
  DecimalSchema as legacyDecimalSchema,
  type Decimal as LegacyDecimal,
} from '../../../confluent/types/decimal_pb'
import { DecimalSchema } from '../../../confluent/type/decimal_pb'
import { create } from '@bufbuild/protobuf'

describe('the legacy confluent/types/decimal.proto descriptor', () => {
  it('is exported from the package root under its old name', () => {
    expect(file_confluent_types_decimal.proto.name).toBe('confluent/types/decimal.proto')
  })

  // Declaring nothing is what lets it be registered alongside the canonical file: a second
  // declaration of confluent.type.Decimal would collide.
  it('declares no messages of its own', () => {
    expect(file_confluent_types_decimal.proto.messageType).toEqual([])
    expect(file_confluent_types_decimal.proto.publicDependency).toEqual([0])
  })

  // The module that shipped at this path exported the message type and its schema as well as
  // the descriptor. protoc-gen-es emits no symbol re-exports for a public import, so codegen.sh
  // appends them - which `buf generate` would silently drop, hence this test. Go and Python
  // preserve the same two names at their own old paths.
  it('still exports Decimal and DecimalSchema for a deep import of the old path', () => {
    expect(legacyDecimalSchema).toBe(DecimalSchema)
    expect(legacyFile).toBe(file_confluent_types_decimal)

    // `Decimal` is type-only, so it is exercised by using it: this fails to compile if the
    // re-export is missing, which is the whole point.
    const d: LegacyDecimal = create(legacyDecimalSchema, { scale: 2 })
    expect(d.$typeName).toBe('confluent.type.Decimal')
    expect(d.scale).toBe(2)
  })

  // And the symbol still resolves through it, to the one declaration in the canonical file.
  it('re-exports confluent.type.Decimal from the canonical file', () => {
    const registry = createFileRegistry(
      file_confluent_types_decimal.proto,
      (name) => name === 'confluent/type/decimal.proto'
        ? file_confluent_type_decimal.proto
        : undefined)
    const message = registry.getMessage('confluent.type.Decimal')

    expect(message).toBeDefined()
    expect(message?.file.proto.name).toBe('confluent/type/decimal.proto')
  })
})
