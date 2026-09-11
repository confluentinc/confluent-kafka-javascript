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
import { isCelList, isCelMap, isCelUint } from '@bufbuild/cel'
import { ScalarType, type DescField, type DescMessage, type Message } from '@bufbuild/protobuf'
import { isReflectMessage, reflect, type ReflectMessage } from '@bufbuild/protobuf/reflect'

/**
 * Rebuilds `schema`'s message type from `result`, or returns `result` unchanged when it is
 * not a map.
 */
export function convertProtobufResult(result: any, schema: DescMessage): any {
  if (isReflectMessage(result)) {
    // A rule that returns a message rather than building one - `message` echoed whole, or a
    // value type - comes back from cel-es wrapped in a ReflectMessage. Nested field positions
    // want that wrapper (`ReflectMessage.set` takes one), but the root result goes straight to
    // the serializer's `toBinary`, which wants the plain message: measured, an identity
    // `message` transform failed with "cannot use field test.ValueTypeContainers.amounts with
    // message undefined", naming a field the rule never touched. The reference has no wrapper
    // to strip - cel-java hands back the Message itself, and ProtobufResultWriter.convert
    // returns any non-Map result unchanged - which is what this restores.
    return result.message
  }
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
      // Elements need the same narrowing as a singular field: CEL widens every integer to
      // int64, and protobuf reflection wants a number for the 32-bit types and for an enum.
      for (const item of requireList(field, value)) {
        if (item === null || item === undefined) {
          throw new Error(`cannot write null to repeated field ${field.name}`)
        }
        list.add(element !== undefined
          ? asMessageValue(element, item)
          : narrowElement(field, field.listKind, unwrap(item)))
      }
      return
    }
    case 'map': {
      const map = out.get(field) as any
      const element = field.mapKind === 'message' ? field.message : undefined
      for (const [k, v] of requireEntries(field, value)) {
        if (v === null || v === undefined) {
          throw new Error(`cannot write a null value to map field ${field.name}`)
        }
        // A map key is always a scalar - protobuf does not permit an enum or message key.
        map.set(narrowScalar(field.mapKey, field, unwrap(k)) as any, element !== undefined
          ? asMessageValue(element, v)
          : narrowElement(field, field.mapKind, unwrap(v)))
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

/**
 * The elements of a list result, or a rule error.
 *
 * A shape mismatch has to be an error, not a no-op: the message is rebuilt field by field under
 * replace semantics, so yielding nothing left the field *empty* and reported success -
 * `{"amounts": 1}` looked applied and came back with no elements at all. The reference rejects
 * the same mismatch, because its message-level write-back renders the result to protobuf JSON and
 * parses it: measured against protobuf-java, `{"amounts": 1}` is "Expected an array for amounts
 * but found 1", and a string or an object in that position is refused the same way.
 *
 * A string and a map are named rather than left to the iterability test: both are iterable, so a
 * string would spread into one element per character and a map would write its *keys* as the list
 * - corruption rather than loss.
 */
function requireList(field: DescField, value: any): Iterable<any> {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' && !(value instanceof Map) && value != null
      && typeof value[Symbol.iterator] === 'function' && typeof value.entries !== 'function') {
    return value
  }
  throw new Error(`cannot write ${describe(value)} to repeated field ${field.name}`)
}

/**
 * The entries of a map result, or a rule error - {@link requireList}'s counterpart, and the same
 * reasoning: leaving the map empty deleted the field and reported success. Measured,
 * `{"amount_map": 1}` on the reference is "Expect a map object but found: 1", and so are a string
 * and an array in that position.
 */
function requireEntries(field: DescField, value: any): [unknown, unknown][] {
  const entries = asEntries(value)
  if (entries === null) {
    throw new Error(`cannot write ${describe(value)} to map field ${field.name}`)
  }
  return entries
}

/** Names the offending value's shape for the two errors above. */
function describe(value: any): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value) || isCelList(value)) return 'a list'
  if (value instanceof Map || isCelMap(value)) return 'a map'
  if (isReflectMessage(value)) return value.desc.typeName
  return typeof value
}

/**
 * Values pass through as the runtime produced them, except a CEL `uint`.
 *
 * cel-es wraps messages in a `ReflectMessage`, and that is exactly what `ReflectMessage.set`
 * wants for a message-valued field - unwrapping to the bare message here fails with
 * "expected ReflectMessage, got message". The unwrapping happens once at the top, via
 * `out.message`.
 *
 * A CEL `uint` is the one value that does need unwrapping: cel-es carries it as a `CelUint`
 * wrapper around a bigint, not as a bigint, so it never matched the `typeof value === 'bigint'`
 * test in {@link narrowScalar} and reached protobuf reflection whole. Measured, an *identity*
 * message-level transform over a uint32 field failed with
 * `FieldError: expected number (uint32), got object`, while the same transform over int32,
 * sint64 and double round-tripped - so the fault was unsignedness, and it covered
 * uint32/uint64/fixed32/fixed64. The reference does not hit this: Java's message-level
 * write-back renders the CEL result map to protobuf JSON with Jackson and parses it with
 * `ProtobufSchema.fromJson`, where an unsigned value is just a JSON number.
 *
 * Done here rather than in `narrowScalar` because this is already applied at every value
 * position - plain scalar, list element, map value, and map *key* (protobuf permits
 * `map<uint32, V>`). Range and sign are left to protobuf reflection, as they are for every
 * other scalar in this writer.
 */
function unwrap(value: any): unknown {
  return isCelUint(value) ? value.value : value
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
  if (field.fieldKind !== 'scalar' && field.fieldKind !== 'enum') {
    return value
  }
  return narrowElement(field, field.fieldKind, value)
}

/**
 * One value at a singular, list-element or map-value position. `kind` says which of
 * `field.scalar` and `field.enum` describes it, because on a repeated or map field those
 * describe the element rather than the field.
 */
function narrowElement(field: DescField, kind: string, value: unknown): unknown {
  if (kind === 'enum') {
    return narrowEnum(field, value)
  }
  return narrowScalar(kind === 'scalar' ? field.scalar : undefined, field, value)
}

/**
 * Narrows a CEL value to a protobuf enum number.
 *
 * CEL has no enum type: cel-es reads an enum field as an int, which this runtime carries as a
 * `bigint`, and protobuf reflection wants the generated numeric value - so an identity
 * transform over a message with an enum field failed with "expected enum test.Status, got 1n".
 *
 * A string is taken as the value's symbol name, which is what the reference accepts:
 * `JsonFormat.parseEnum` reads a name as well as a number, so a rule may legitimately write
 * "ACTIVE" rather than 1. An unknown name is a rule error rather than a silent zero. Whether an
 * unrecognised *number* is allowed is left to protobuf reflection, which keeps it for an open
 * (proto3) enum and refuses it for a closed one - `findValueByNumberCreatingIfUnknown` versus
 * `findValueByNumber` on the reference.
 */
function narrowEnum(field: DescField, value: unknown): unknown {
  if (typeof value === 'string') {
    const found = field.enum?.values.find((v) => v.name === value)
    if (found === undefined) {
      throw new Error(`invalid enum value ${value} for enum type ${field.enum?.typeName}`)
    }
    return found.number
  }
  const num = typeof value === 'bigint' ? Number(value) : value
  if (typeof num === 'number' && Number.isInteger(num) && (num < -(2 ** 31) || num > 2 ** 31 - 1)) {
    // An enum number is an int32 on the wire, and the reference range-checks it before the
    // open/closed decision above.
    throw new Error(`value ${num} is out of range for enum type ${field.enum?.typeName}`)
  }
  return num
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
