import { describe, expect, it } from '@jest/globals';
import { create } from '@bufbuild/protobuf';
import { FileDescriptorProtoSchema } from '@bufbuild/protobuf/wkt';
import { newFileRegistry } from '../../serde/protobuf';

// A one-field schema importing `dep` and referring to `typeName`, the shape the registry hands
// back for a Protobuf schema whose only reference is a built-in.
function schemaImporting(dep: string, typeName: string) {
  return create(FileDescriptorProtoSchema, {
    name: 'test.proto',
    package: 'test',
    dependency: [dep],
    syntax: 'proto3',
    messageType: [{
      name: 'M',
      field: [{ name: 'f', number: 1, type: 11, label: 1, typeName }],
    }],
  });
}

// The canonical import path is confluent/type/... - what the Java client registers and what
// ProtobufSchema declares. The generated descriptors here were named confluent/types/... after
// the directory the Go client needs (`type` is a keyword there), which this client copied, and
// neither spelling loaded: the canonical one was found in builtinDeps and then failed as
// "Cannot find confluent/type/decimal.proto, imported by test.proto" - createFileRegistry
// matches a dependency edge by the file's own name, not by the name it was looked up under -
// while the plural one was never a key at all.
describe('built-in confluent dependencies', () => {
  const cases: [string, string, string][] = [
    ['confluent/type/decimal.proto', '.confluent.type.Decimal', 'confluent.type.Decimal'],
    ['confluent/type/variant.proto', '.confluent.type.Variant', 'confluent.type.Variant'],
  ]

  it.each(cases)('resolves %s', (dep, typeName, expected) => {
    const registry = newFileRegistry(schemaImporting(dep, typeName), new Map())
    const field = registry.getMessage('test.M')?.fields[0]
    expect(field?.fieldKind).toBe('message')
    expect((field as { message: { typeName: string } }).message.typeName).toBe(expected)
  })

  // The plural spellings stand in for a stale producer, and are why this is worth a test.
  it.each([
    'confluent/types/decimal.proto',
    'confluent/types/variant.proto',
    'confluent/type/nope.proto',
  ])('reports %s as an unknown built-in', (dep) => {
    expect(() => newFileRegistry(schemaImporting(dep, '.confluent.type.Decimal'), new Map()))
      .toThrow(`dependency ${dep} not found`)
  })
})
