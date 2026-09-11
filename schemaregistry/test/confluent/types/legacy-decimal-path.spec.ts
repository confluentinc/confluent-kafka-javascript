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
