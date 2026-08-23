import { describe, expect, it } from '@jest/globals';
import {
  clone,
  create,
  createFileRegistry,
  createRegistry,
  DescFile,
} from '@bufbuild/protobuf';
import {
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  FileDescriptorProtoSchema,
} from '@bufbuild/protobuf/wkt';
import type { Registry } from '@bufbuild/protobuf';
import { CelExecutor } from '../../../rules/cel/cel-executor';
import { RuleContext, RuleError } from '../../../serde/serde';
import { RuleMode } from '../../../schemaregistry-client';
import { ValidationInnerSchema } from '../../serde/test/validation_widget_pb';

/**
 * A second descriptor for test.ValidationInner that keeps the original filename but adds a
 * field, standing in for a schema whose references resolve to a different dependency
 * version - or simply for a second serde instance with its own registry.
 */
function evolvedInner() {
  const original: DescFile = ValidationInnerSchema.file
  const proto = clone(FileDescriptorProtoSchema, original.proto)
  const message = proto.messageType.find((m) => m.name === 'ValidationInner')!
  message.field.push(create(FieldDescriptorProtoSchema, {
    name: 'extra',
    number: 99,
    type: FieldDescriptorProto_Type.INT32,
    label: FieldDescriptorProto_Label.OPTIONAL,
    jsonName: 'extra',
  }))
  const deps = new Map<string, DescFile>()
  const collect = (file: DescFile) => {
    for (const dep of file.dependencies) {
      if (!deps.has(dep.proto.name)) {
        deps.set(dep.proto.name, dep)
        collect(dep)
      }
    }
  }
  collect(original)
  const registry = createFileRegistry(proto, (name) => deps.get(name)?.proto)
  return registry.getMessage('test.ValidationInner')!
}

// Both contexts carry the same schema text and rule, which is all the program cache key
// used to be built from.
function ctxFor(expr: string, registry: Registry): RuleContext {
  const rule = {
    name: 'r', type: 'CEL', mode: RuleMode.WRITE, kind: 'TRANSFORM', expr,
  } as any
  const target = { schema: 'the-same-schema-text', schemaType: 'PROTOBUF' } as any
  return new RuleContext(undefined, null, target, 'subject', 'topic', false, RuleMode.WRITE,
    rule, 0, [rule], null, null as any, registry)
}

describe('CelExecutor program cache', () => {
  it('does not reuse a plan across registries', async () => {
    const executor = new CelExecutor()
    const expr = 'message.extra > 0'
    const evolved = evolvedInner()
    const evolvedMsg = { $typeName: evolved.typeName, x: 1, extra: 7 } as any

    // A registry that does not know `extra` cannot resolve it. CEL returns its errors as
    // values rather than throwing them; the executor turns one into a RuleError.
    await expect(executor.transform(
      ctxFor(expr, createRegistry(ValidationInnerSchema)),
      create(ValidationInnerSchema, { x: 1 }))).rejects.toThrow(RuleError)

    // The registry that does know it must still resolve it, rather than inheriting the
    // plan cached above.
    expect(await executor.transform(ctxFor(expr, createRegistry(evolved)), evolvedMsg))
      .toBe(true)
  })
})
