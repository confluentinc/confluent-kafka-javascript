/**
 * Rebuilds a protobuf message from the map a message-level `CEL` transform returned.
 *
 * A rule that returns a map is returning **the whole new message**: the transform has replace
 * semantics, not merge. Three consequences a rule author needs to know, and every client has
 * to match:
 *
 * - a field the rule does not name is **dropped**, so a rule naming only the field it changes
 *   discards the rest;
 * - a `null` in the map **clears** its field;
 * - echoing a field that was absent **materialises** it, because reading it produced a value.
 *   Preserve absence with `has(x) ? x : null`.
 *
 * Without this the executor returned the cel-es `NativeMap` raw, which the protobuf serializer
 * cannot write, so every message-level transform failed - including an identity one.
 *
 * **Mechanism note.** The JVM client rebuilds by rendering the result to JSON and parsing it
 * back. This builds the message directly through `@bufbuild/protobuf`'s reflection instead,
 * because a JSON round trip would base64 every bytes field and format every timestamp only to
 * parse them straight back. The behaviours the JVM client gets free from the JSON mapping -
 * null clearing a field, and a key matching either the declared or the JSON name - are
 * reproduced explicitly below.
 *
 * This client needs no per-type conversion for decimal, timestamp and variant: cel-es carries
 * all three as protobuf messages, wrapped in a `ReflectMessage`, so unwrapping is enough.
 */
import { ScalarType, type DescField, type DescMessage, type Message } from '@bufbuild/protobuf'
import { isReflectMessage, reflect, type ReflectMessage } from '@bufbuild/protobuf/reflect'

/**
 * Rebuilds `schema`'s message type from `result`, or returns `result` unchanged when it is
 * not a map.
 */
export function convertProtobufResult(result: any, schema: DescMessage): any {
  const entries = asEntries(result)
  if (entries === null) {
    return result
  }
  const out = reflect(schema)
  fill(out, entries)
  return out.message
}

/** Normalises the shapes a CEL map result can take into key/value pairs. */
function asEntries(result: any): [unknown, unknown][] | null {
  if (result == null || typeof result !== 'object') {
    return null
  }
  if (isReflectMessage(result) || (result as Message).$typeName !== undefined) {
    // Already a message - a rule that returned one directly needs no rebuilding.
    return null
  }
  if (result instanceof Map) {
    return [...result.entries()]
  }
  if (typeof (result as any).entries === 'function') {
    return [...(result as any).entries()]
  }
  return null
}

function fill(out: ReflectMessage, entries: [unknown, unknown][]): void {
  for (const [key, value] of entries) {
    const field = findField(out.desc, String(key))
    if (field === undefined) {
      // A key the schema does not declare has nowhere to go. Dropping it matches the JVM
      // client, whose JSON parse ignores unknown fields.
      continue
    }
    if (value === null || value === undefined) {
      // An explicit null clears the field, which is how a rule preserves an absent value
      // across a transform that echoes it.
      out.clear(field)
      continue
    }
    setField(out, field, value)
  }
}

/**
 * Resolves a result key by declared name, then by JSON name: a rule may legitimately return
 * either, so matching only the declared name would silently skip a field like `total_amount`.
 */
function findField(desc: DescMessage, name: string): DescField | undefined {
  return desc.fields.find((f) => f.name === name)
    ?? desc.fields.find((f) => f.jsonName === name)
}

function setField(out: ReflectMessage, field: DescField, value: any): void {
  switch (field.fieldKind) {
    case 'list': {
      const list = out.get(field) as any
      const element = field.listKind === 'message' ? field.message : undefined
      // Elements need the same scalar narrowing as a singular field: CEL widens every integer
      // to int64, and protobuf reflection wants a number for the 32-bit types.
      const elementScalar = field.listKind === 'scalar' ? field.scalar : undefined
      for (const item of iterate(value)) {
        if (item === null || item === undefined) continue
        list.add(element !== undefined
          ? asMessageValue(element, item)
          : narrowScalar(elementScalar, field, unwrap(item)))
      }
      return
    }
    case 'map': {
      const map = out.get(field) as any
      const entries = asEntries(value)
      if (entries === null) return
      const element = field.mapKind === 'message' ? field.message : undefined
      const valueScalar = field.mapKind === 'scalar' ? field.scalar : undefined
      for (const [k, v] of entries) {
        if (v === null || v === undefined) continue
        map.set(narrowScalar(field.mapKey, field, unwrap(k)) as any, element !== undefined
          ? asMessageValue(element, v)
          : narrowScalar(valueScalar, field, unwrap(v)))
      }
      return
    }
    case 'message':
      out.set(field, asMessageValue(field.message, value) as any)
      return
    default:
      out.set(field, narrow(field, unwrap(value)) as any)
  }
}

/**
 * A value bound for a message-valued field, rebuilt from a CEL map when that is what the rule
 * returned.
 *
 * `ReflectMessage.set` wants a message, and cel-es hands one back wrapped in a `ReflectMessage`,
 * which is exactly what it wants - so a rule that *echoes* a nested message needs nothing. A rule
 * that **constructs** one returns a CEL map instead (`{"inner": decimal("8.88")}`), and setting
 * that raised `expected ReflectMessage (test.ValueTypeNested), got object`.
 *
 * The root message is already built from a map this way; this is the same step one level down.
 * It recurses through {@link fill}, so a constructed message nested to any depth works, as does
 * one constructed inside a list or a map.
 */
function asMessageValue(desc: DescMessage, value: any): unknown {
  const entries = asEntries(value)
  if (entries === null) {
    return value
  }
  const nested = reflect(desc)
  fill(nested, entries)
  return nested
}

function iterate(value: any): any[] {
  if (Array.isArray(value)) return value
  if (value != null && typeof value[Symbol.iterator] === 'function'
      && typeof value !== 'string') {
    return [...value]
  }
  return []
}

/**
 * Values pass through as the runtime produced them.
 *
 * cel-es wraps messages in a `ReflectMessage`, and that is exactly what `ReflectMessage.set`
 * wants for a message-valued field - unwrapping to the bare message here fails with
 * "expected ReflectMessage, got message". The unwrapping happens once at the top, via
 * `out.message`.
 */
function unwrap(value: any): unknown {
  return value
}

/**
 * Narrows a CEL number to what the field's scalar type accepts.
 *
 * CEL has one integer type and this runtime carries it as a `bigint`, but @bufbuild stores
 * 32-bit fields as JS numbers and rejects a bigint outright ("expected number (int32), got
 * 7n"). 64-bit fields keep the bigint, or become strings when the field is generated with
 * `longAsString`.
 */
function narrow(field: DescField, value: unknown): unknown {
  if (field.fieldKind !== 'scalar') {
    return value
  }
  return narrowScalar(field.scalar, field, value)
}

/**
 * The scalar conversion itself, keyed on an explicit scalar type so a repeated or map field can
 * narrow its elements - `field.scalar` on those describes the element, not the field.
 */
function narrowScalar(scalar: ScalarType | undefined, field: DescField, value: unknown): unknown {
  if (scalar === undefined) {
    return value
  }
  switch (scalar) {
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
    case ScalarType.INT32:
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
      return typeof value === 'bigint' ? Number(value) : value
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      if ((field as any).longAsString === true) {
        return String(value)
      }
      return typeof value === 'number' ? BigInt(value) : value
    default:
      return value
  }
}
