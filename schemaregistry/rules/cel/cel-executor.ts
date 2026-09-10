import {RuleRegistry} from "../../serde/rule-registry";
import {convertProtobufResult} from "./protobuf-result-writer";
import {RuleContext, RuleError, RuleExecutor} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import stringify from "json-stringify-deterministic";
import {LRUCache} from "lru-cache";
import {CelEnv, celEnv, isCelError, parse, plan} from "@bufbuild/cel";
import { strings as STRINGS_EXT_FUNCS } from "@bufbuild/cel/ext";
import { Registry } from "@bufbuild/protobuf";
import { timestampNow } from "@bufbuild/protobuf/wkt";
import { DECIMAL_FUNCS, decimalFromBytesScale, decimalToAvroBytes, isCelDecimal } from "./decimal-funcs";
import { TIMESTAMP_FUNCS, avroTimestampToCel, isCelTimestamp, timestampToEpoch } from "./timestamp-funcs";
import { IS_FUNCS } from "./is-funcs";
import { VARIANT_FUNCS, tryReader, variantToCel } from "./variant-funcs";
import { Variant } from "../../confluent/types/variant-utils";

export class CelExecutor implements RuleExecutor {
  config: Map<string, string> | null = null
  env: CelEnv = celEnv({
    funcs: [...STRINGS_EXT_FUNCS, ...DECIMAL_FUNCS, ...TIMESTAMP_FUNCS, ...IS_FUNCS, ...VARIANT_FUNCS],
  });
  cache: LRUCache<string, any> = new LRUCache({max: 1000})
  // Envs carrying a protobuf registry, one per registry encountered. CEL resolves field
  // access on a protobuf message through its registry, so evaluating a rule against one
  // requires an env that knows the message's type.
  protoEnvs: WeakMap<Registry, ProtoEnv> = new WeakMap()
  private nextProtoEnvId = 1

  static register(): CelExecutor {
    const executor = new CelExecutor()
    RuleRegistry.registerRuleExecutor(executor)
    return executor
  }

  configure(clientConfig: ClientConfig, config: Map<string, string>) {
    this.config = config
  }

  type(): string {
    return "CEL"
  }

  async transform(ctx: RuleContext, msg: any): Promise<any> {
    const args = {
      message: this.wrapForCel(ctx, msg),
    }
    return await this.execute(ctx, msg, args)
  }

  /**
   * Presents the message the way CEL should see it. Avro decimals are unscaled bytes and Avro
   * timestamps a bare epoch int, so they are converted to self-describing Decimal/Timestamp
   * values (scale/unit from the schema) - letting a rule read `decimal(message.f)` /
   * `timestamp(message.f)` without a scale/unit literal, the cross-language canonical form.
   * Protobuf messages are passed through unchanged; their fields resolve through the
   * registry-carrying env built in {@link envFor}.
   */
  wrapForCel(ctx: RuleContext, msg: any): any {
    if (msg == null || typeof msg !== "object") {
      return msg
    }
    if (ctx.target?.schemaType === "AVRO" && ctx.target.schema) {
      return wrapAvroForCel(msg, ctx.target.schema)
    }
    return msg
  }

  async execute(ctx: RuleContext, msg: any, args: { [key: string]: any }): Promise<any> {
    let expr = ctx.rule.expr
    if (expr == null) {
      return msg
    }
    const index = expr.indexOf(';')
    if (index >= 0) {
      const guard = expr.substring(0, index)
      if (guard.trim().length != 0) {
        // A guard decides applicability, and one that errors - typically by probing a field
        // some messages don't carry - is treated as not applicable rather than as a failure.
        // Matches the JVM client (CelExecutor.evaluateWithGuard), which swallows the guard's
        // exception and requires an explicit `true` to go on to the body.
        let guardResult: any = false
        try {
          guardResult = await this.executeRule(ctx, guard, msg, args)
        } catch (e) {
          // ignore — an error in the guard is treated as false (skip the body).
        }
        if (guardResult !== true) {
          // skip the expr
          if (ctx.rule.kind === 'CONDITION') {
            return true
          }
          return msg
        }
      }
      expr = expr.substring(index + 1)
    }
    return this.writeBack(ctx, msg, await this.executeRule(ctx, expr, msg, args))
  }

  /**
   * Shapes a rule result into the form this format's serializer expects. A CONDITION answers
   * with a bool and is left alone; a protobuf TRANSFORM returning a map is returning a whole
   * new message and has to be rebuilt into one.
   */
  writeBack(ctx: RuleContext, msg: any, result: any): any {
    if (ctx.rule.kind === 'CONDITION') {
      return result
    }
    if (ctx.target?.schemaType === "AVRO" && ctx.target.schema) {
      // A CEL_FIELD rule runs through this same execute(), and its result is one field's value
      // rather than a whole record - so the field context selects which schema node to convert
      // against, exactly as it does for the read in wrapAvroFieldForCel. This used to bail out
      // instead, leaving CelFieldExecutor to convert afterwards through a second, smaller
      // converter; the guard existed only to stop the two from both running.
      // The dependency texts travel with the read for the same reason they do here: a tagged
      // field can be *declared* in a referenced schema, and the declaration is what carries a
      // decimal's scale. Without them the write-back could not resolve such a field either,
      // and the computed Decimal reached the Avro writer unconverted ("expected \"bytes\", got
      // a ReflectMessageImpl").
      const deps = ctx.depSchemas ?? []
      const field = ctx.currentField()
      return field != null
        ? unwrapAvroFieldFromCel(result, field.fullName, ctx.target.schema, deps)
        : unwrapAvroFromCel(result, ctx.target.schema, deps)
    }
    // A CEL_FIELD result is a field value, not a message, so there is nothing for the protobuf
    // writer to rebuild - and $typeName below would be the containing message's, which would
    // rebuild the wrong thing entirely.
    if (ctx.currentField() != null) {
      return result
    }
    const typeName = msg?.$typeName
    if (typeName == null || ctx.registry == null) {
      return result
    }
    const schema = ctx.registry.getMessage(typeName)
    if (schema == null) {
      return result
    }
    return convertProtobufResult(result, schema)
  }

  async executeRule(ctx: RuleContext, expr: string, obj: any, args: { [key: string]: any }): Promise<any> {
    const schema = ctx.target.schema
    const scriptType = ctx.target.schemaType
    const { env, id } = this.envFor(ctx.registry)
    const rule: RuleWithArgs = {
      rule: expr,
      scriptType: scriptType,
      schema: schema,
      // A plan resolves protobuf field access through the env it was created with, so the
      // env's identity is part of the key. The schema text alone is not enough: the same
      // text can be served by different registries - one per serde instance, and whose
      // references may resolve to different dependency versions - and a plan built from
      // one of them resolves fields against that one's types.
      env: id
    }
    const ruleJson = stringify(rule)
    let program = this.cache.get(ruleJson)
    if (program == null) {
      const parsedExpr = parse(expr)
      program = plan(env, parsedExpr)
      this.cache.set(ruleJson, program)
    }
    // `now` is bound lazily, fresh per evaluation. Only inject when the
    // expression references it. Each rule evaluation sees a freshly-captured
    // UTC instant — mirrors the protovalidate / Python pattern.
    if (expr.includes("now") && args["now"] === undefined) {
      args["now"] = timestampNow()
    }
    // CEL returns evaluation errors as values rather than throwing them, so unwrap the
    // result explicitly - the same as CelValidator.execute. Letting one flow out fails
    // open: an error is not `false`, so a CONDITION rule would pass vacuously, and a
    // TRANSFORM rule would assign the error object as the message. Throwing puts an
    // erroring rule on the framework's failure path (onFailure / ERROR), which is where
    // the JVM client's CelExecutor puts it - its CEL library throws where this one does not.
    const result = program(args)
    if (isCelError(result)) {
      const name = ctx.rule.name ? ctx.rule.name : 'unnamed'
      throw new RuleError(`Could not execute rule '${name}': ${result.message}`)
    }
    return result
  }

  /**
   * Returns the env to evaluate with, and its identity for the program cache: one env
   * carrying the serde's protobuf registry when there is one, otherwise the shared
   * registry-less env.
   */
  envFor(registry?: Registry): ProtoEnv {
    if (registry == null) {
      return { env: this.env, id: '' }
    }
    let protoEnv = this.protoEnvs.get(registry)
    if (protoEnv == null) {
      protoEnv = {
        env: celEnv({
          funcs: [...STRINGS_EXT_FUNCS, ...DECIMAL_FUNCS, ...TIMESTAMP_FUNCS, ...IS_FUNCS, ...VARIANT_FUNCS],
          registry,
        }),
        id: String(this.nextProtoEnvId++)
      }
      this.protoEnvs.set(registry, protoEnv)
    }
    return protoEnv
  }

  async close(): Promise<void> {
  }
}

interface RuleWithArgs {
  rule?: string
  scriptType?: string
  schema?: string
  env?: string
}

interface ProtoEnv {
  env: CelEnv
  // Identifies the env within this executor, for keying the program cache.
  id: string
}

/**
 * Returns a CEL-facing copy of an Avro message with logical-type fields presented as
 * self-describing values (decimal -> confluent.type.Decimal, timestamp -> Timestamp). The
 * original `msg` is left untouched (it is still what gets encoded); only new containers are built.
 */
export function wrapAvroForCel(
  msg: any, schemaStr: string, depSchemas: readonly string[] = [],
): any {
  let schema: any
  try {
    schema = JSON.parse(schemaStr)
  } catch {
    return msg
  }
  const named = collectAvroNamedAll(schema, depSchemas)
  return avroToCel(msg, schema, named)
}

/**
 * Converts one Avro field value for CEL against the field's own schema (located by the field's
 * fully-qualified `record.field` name), so a `CEL_FIELD` rule's `value` binding sees a decimal at
 * its scale / a timestamp in its unit rather than raw bytes. Returns the value unchanged when the
 * schema or field can't be resolved. avsc discards the decimal scale, so it is read from the raw
 * schema JSON here.
 */
export function wrapAvroFieldForCel(
  fieldValue: any, fullName: string, schemaStr: string, depSchemas: readonly string[] = [],
): any {
  const resolved = resolveAvroFieldLeaf(fullName, schemaStr, depSchemas)
  if (resolved == null) {
    return fieldValue
  }
  return avroToCel(fieldValue, resolved.leaf, resolved.named)
}

/**
 * Converts one Avro field value for CEL against the type the field *declares* - an array stays an
 * array, a map a map - with the logical types inside it converted.
 *
 * The difference from {@link wrapAvroFieldForCel} is which of the two paths is calling, and it is
 * not cosmetic. A `CEL_FIELD` rule is applied by the walk, which descends into a container and
 * hands over one *element*, so the element's schema is the right one there. An **inline** field
 * rule is handed the field's whole value, so `this` is the container itself: converting it against
 * the element's schema left every element raw, and `decimals.gt(this[0], ...)` failed with
 * "raw bytes need a scale".
 */
export function wrapAvroDeclaredFieldForCel(
  fieldValue: any, fullName: string, schemaStr: string, depSchemas: readonly string[] = [],
): any {
  const resolved = resolveAvroField(fullName, schemaStr, depSchemas)
  if (resolved == null) {
    return fieldValue
  }
  return avroToCel(fieldValue, resolved.node, resolved.named)
}

/**
 * Encodes a `CEL_FIELD` rule result back to the field's Avro representation: a returned Decimal
 * to unscaled bytes at the schema scale, a returned Timestamp to an epoch value in the schema
 * unit. Anything else (a bool condition result, an unchanged value) passes through. Inverse of
 * {@link wrapAvroFieldForCel}, and deliberately its mirror image: the same {@link celToAvro} the
 * message-level path uses, against the schema node the field context selects.
 *
 * It used to be a second, smaller converter of its own, and the two drifted - the field one had no
 * `variant` arm while `celToAvro` did, so a `CEL_FIELD` transform returning a variant produced a
 * value avsc could not encode. One converter cannot have that gap. The read
 * side has always been shaped this way; this is the write side catching up.
 */
export function unwrapAvroFieldFromCel(
  result: any, fullName: string, schemaStr: string, depSchemas: readonly string[] = [],
): any {
  const resolved = resolveAvroFieldLeaf(fullName, schemaStr, depSchemas)
  if (resolved == null) {
    return result
  }
  return celToAvro(result, resolved.leaf, resolved.named)
}

/**
 * Encodes a message-level `CEL` rule result back to the record's Avro representation, against
 * the schema the message conforms to.
 *
 * The field-level counterpart is {@link unwrapAvroFieldFromCel}; there was no message-level
 * one, so the cel-es map reached the Avro writer unchanged and every message-level transform
 * failed. A decimal, a timestamp and a variant all need their Avro shape back, and the scale
 * and unit live only in the schema - which is why this is schema-driven where the protobuf
 * writer is not.
 */
export function unwrapAvroFromCel(
  result: any, schemaStr: string, depSchemas: readonly string[] = [],
): any {
  let schema: any
  try {
    schema = JSON.parse(schemaStr)
  } catch {
    return result
  }
  const named = collectAvroNamedAll(schema, depSchemas)
  return celToAvro(result, schema, named)
}

/** Inverse of {@link avroToCel}: one CEL value back to its Avro representation. */
function celToAvro(value: any, node: any, named: Map<string, any>): any {
  if (value == null) {
    return value
  }
  if (typeof node === "string" && named.has(node)) {
    node = named.get(node)
  }
  if (Array.isArray(node)) {
    // A union: pick the branch that can actually carry this value, the way Java's
    // AvroResultWriter.resolveUnion does. Taking the first non-null branch positionally sent a
    // decimal result down the "string" branch of ["null","string",{...decimal}] and left the
    // bytes unencoded.
    const branch = pickAvroWriteBranch(node, value, named)
    return branch != null ? celToAvro(value, branch, named) : value
  }
  if (typeof node !== "object") {
    // The short form of an integer type: CEL carries it as a bigint and avsc rejects those
    // outright ("Cannot mix BigInt and other types").
    return typeof value === "bigint" ? Number(value) : value
  }

  switch (node.logicalType) {
    case "decimal":
      return isCelDecimal(value)
        ? Buffer.from(decimalToAvroBytes(value, node.scale ?? 0))
        : value
    case "timestamp-millis":
      return isCelTimestamp(value) ? timestampToEpoch(value, "millis") : value
    case "timestamp-micros":
      return isCelTimestamp(value) ? timestampToEpoch(value, "micros") : value
    case "timestamp-nanos":
      return isCelTimestamp(value) ? timestampToEpoch(value, "nanos") : value
    case "variant":
      return celVariantToAvro(value)
  }

  switch (node.type) {
    case "record": {
      // Replace semantics: the result is the whole new record, so only the keys it names are
      // written and a field it omits is simply absent.
      const entries = celEntries(value)
      if (entries == null) {
        return value
      }
      const out: Record<string, any> = Object.create(null)
      for (const field of node.fields ?? []) {
        if (hasOwn(entries, field.name)) {
          out[field.name] = celToAvro(entries[field.name], field.type, named)
        }
      }
      return out
    }
    case "array": {
      const elements = celElements(value)
      return elements != null
        ? elements.map((v) => celToAvro(v, node.items, named))
        : value
    }
    case "map": {
      const entries = celEntries(value)
      if (entries == null) {
        return value
      }
      const out: Record<string, any> = Object.create(null)
      for (const key of Object.keys(entries)) {
        out[key] = celToAvro(entries[key], node.values, named)
      }
      return out
    }
    case "int":
    case "long":
      return typeof value === "bigint" ? Number(value) : value
    default:
      return value
  }
}

/**
 * An Avro variant field reaches here as a {@link Variant} (the `variant` logical type decodes
 * to one), or as the raw `{metadata, value}` record when the logical type is not registered.
 * cel-es cannot bind a bare Variant, so it is wrapped the way `variants.*` expects.
 */
function avroVariantToCel(value: any): any {
  if (value instanceof Variant) {
    return variantToCel(value)
  }
  if (value != null && typeof value === "object" && "metadata" in value && "value" in value) {
    return variantToCel(new Variant(value.value, value.metadata))
  }
  return value
}

/**
 * The inverse: back to a {@link Variant}, which is what avsc's `variant` logical type encodes
 * from (see VariantLogicalType._toValue). A value that is not a variant passes through.
 */
function celVariantToAvro(value: any): any {
  if (value instanceof Variant) {
    return value
  }
  const reader = tryReader(value)
  return reader != null ? reader : value
}

/**
 * cel-es returns its own list type - `ArrayList`, `RepeatedFieldList` - rather than a JS Array,
 * so an `Array.isArray` guard rejected it and passed it straight through to the Avro writer,
 * which then failed with `expected {"type":"array"}, got a ArrayList`. The
 * counterpart of {@link celEntries}, which already had to do this for maps.
 *
 * Duck-typed on `size` plus iterability rather than on a cel-es class, because the runtime has
 * several list implementations and a rule can produce any of them.
 */
function celElements(value: any): any[] | null {
  if (Array.isArray(value)) {
    return value
  }
  if (value != null && typeof value === "object" && typeof value.size === "number"
      && typeof value[Symbol.iterator] === "function") {
    return [...value]
  }
  return null
}

/** cel-es returns a NativeMap rather than a plain object; both are flattened to entries here. */
function celEntries(value: any): Record<string, any> | null {
  if (value == null || typeof value !== "object") {
    return null
  }
  if (typeof value.entries === "function") {
    // Null-prototype: an Avro map key is an arbitrary string, and "__proto__" on a normal
    // object literal is a prototype assignment rather than an own property - the entry was
    // dropped before it ever reached the writer.
    const out: Record<string, any> = Object.create(null)
    for (const [k, v] of value.entries()) {
      out[String(k)] = v
    }
    return out
  }
  return value as Record<string, any>
}

/**
 * Resolves the schema node the field named by `fullName` (`record.field`) *declares*, containers
 * and all.
 */
function resolveAvroField(
  fullName: string,
  schemaStr: string,
  depSchemas: readonly string[] = [],
): { node: any; named: Map<string, any> } | null {
  let schema: any
  try {
    schema = JSON.parse(schemaStr)
  } catch {
    return null
  }
  const dot = fullName.lastIndexOf(".")
  if (dot < 0) {
    return null
  }
  const recordName = fullName.substring(0, dot)
  const fieldName = fullName.substring(dot + 1)
  const named = collectAvroNamedAll(schema, depSchemas)
  const record = named.get(recordName)
  if (record == null || !Array.isArray(record.fields)) {
    return null
  }
  const field = record.fields.find((f: any) => f.name === fieldName)
  if (field == null) {
    return null
  }
  return { node: field.type, named }
}

/**
 * Resolves the leaf schema of the field named by `fullName` (`record.field`) within the root
 * schema. The walk hands a field rule the already-unwrapped element (array item, map value, or
 * union branch), so the leaf is the container's element type, not the container itself.
 */
function resolveAvroFieldLeaf(
  fullName: string,
  schemaStr: string,
  depSchemas: readonly string[] = [],
): { leaf: any; named: Map<string, any> } | null {
  const resolved = resolveAvroField(fullName, schemaStr, depSchemas)
  if (resolved == null) {
    return null
  }
  return { leaf: avroLeafNode(resolved.node, resolved.named), named: resolved.named }
}

/** Unwraps array/map/union containers down to the leaf schema a primitive field value carries. */
function avroLeafNode(node: any, named: Map<string, any>): any {
  node = resolveAvroNode(node, named)
  if (Array.isArray(node)) {
    const branch = node.find((b) => !isNullBranch(b))
    return branch != null ? avroLeafNode(branch, named) : node
  }
  if (node != null && typeof node === "object" && !node.logicalType) {
    if (node.type === "array") return avroLeafNode(node.items, named)
    if (node.type === "map") return avroLeafNode(node.values, named)
  }
  return node
}

/**
 * Writes one entry, by definition rather than by assignment.
 *
 * `out[key] = v` invokes the inherited `__proto__` setter for that one key instead of creating
 * an own property: the entry is silently dropped when the value is a primitive, and replaces
 * the object's prototype when it is not. Avro map keys are arbitrary strings, so the map arm
 * is reachable from data - verified: `{}` then `out["__proto__"] = {x:9}` leaves `Object.keys`
 * as `["a"]` with `hasOwnProperty` false, where this keeps the entry and reads it back. Java
 * holds a map in a `HashMap`, where the key is just a string, so there was no reference
 * behaviour behind the divergence.
 *
 * The record arm was *not* broken, because its `{ ...value }` spread copies own properties by
 * definition rather than by assignment, so the own `__proto__` already exists and the later
 * write lands on it. (`__proto__` is a legal Avro name - the grammar is
 * `[A-Za-z_][A-Za-z0-9_]*`.) It goes through here anyway so the record arm does not depend on
 * that spread for its correctness.
 *
 * `Object.create(null)` - which the *write* path (`celToAvro`/`celEntries`) uses for the same
 * hazard - is not an option here, because this object goes to cel-es rather than to avsc, and
 * cel-es types a value through its prototype: a null-prototype record failed with
 * "Cannot read properties of undefined (reading 'name')". Defining the property keeps the
 * ordinary prototype and still shadows the accessor.
 */
function setEntry(out: Record<string, any>, key: string, value: unknown): void {
  Object.defineProperty(out, key, {
    value, enumerable: true, writable: true, configurable: true,
  })
}

function avroToCel(value: any, node: any, named: Map<string, any>): any {
  node = resolveAvroNode(node, named)
  if (value == null || node == null) {
    return value
  }
  if (Array.isArray(node)) {
    // Union: convert against the branch the value took (the common `[null, X]` shape).
    const branch = pickAvroUnionBranch(node, value, named)
    return branch != null ? avroToCel(value, branch, named) : value
  }
  if (typeof node !== "object") {
    // A primitive in its short form - the bare string "int", "long", "string", ... rather than
    // {"type": "int"}. Only the integer types need converting; every other primitive already maps
    // to the right CEL type. This early return is why the long form ({"type":"int",
    // "logicalType":"date"}) reached the switch below and the short form did not.
    return typeof node === "string" ? avroIntegerToCel(node, value) : value
  }
  switch (node.logicalType) {
    case "decimal":
      return value instanceof Uint8Array
        ? decimalFromBytesScale(value, node.scale ?? 0)
        : value
    case "timestamp-millis":
      return avroTimestampToCel(Number(value), "millis")
    case "timestamp-micros":
      return avroTimestampToCel(Number(value), "micros")
    case "timestamp-nanos":
      return avroTimestampToCel(Number(value), "nanos")
    case "variant":
      // Without this arm a confluent.type.Variant record fell to the "record" case below and
      // became a plain object, so `variants.type(message.data)` had nothing it recognised and
      // failed - and since CEL_FIELD skips records, that made variants unreachable from JS
      // domain rules entirely.
      return avroVariantToCel(value)
  }
  switch (node.type) {
    case "record": {
      const out: Record<string, any> = { ...value }
      for (const field of node.fields ?? []) {
        if (hasOwn(value, field.name)) {
          setEntry(out, field.name, avroToCel(value[field.name], field.type, named))
        }
      }
      return out
    }
    case "array":
      return Array.isArray(value)
        ? value.map((v) => avroToCel(v, node.items, named))
        : value
    case "map": {
      const out: Record<string, any> = {}
      for (const key of Object.keys(value)) {
        setEntry(out, key, avroToCel(value[key], node.values, named))
      }
      return out
    }
    case "int":
    case "long":
      return avroIntegerToCel(node.type, value)
    default:
      return value
  }
}

/**
 * Presents an Avro `int`/`long` as a CEL **int**, leaving every other type untouched.
 *
 * avsc hands out a plain JS number for both, and cel-es reads a number as a *double* - so without
 * this `message.count + 1` failed with "no matching overload for '_+_' applied to '(double, int)'"
 * while `message.count == 1` still passed, because cel-es compares across the numeric types. That
 * combination is what made the divergence silent. The Java reference widens int/short/byte to long
 * for the same reason.
 *
 * Logical types riding on int/long are either handled before this (the timestamps) or deliberately
 * left as ints by Java (`date`, `time-millis`, `time-micros`), so they want this conversion too.
 *
 * A non-integral or non-numeric value passes through untouched rather than risking a RangeError
 * from BigInt(); a long beyond 2^53 has already lost precision inside avsc, which nothing here can
 * recover.
 */
function avroIntegerToCel(typeName: string, value: any): any {
  if (typeName !== "int" && typeName !== "long") {
    return value
  }
  if (typeof value === "bigint") {
    return value
  }
  return typeof value === "number" && Number.isInteger(value) ? BigInt(value) : value
}

function isNullBranch(node: any): boolean {
  return node === "null" || (typeof node === "object" && node?.type === "null")
}

function hasOwn(obj: any, key: string): boolean {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key)
}

function isAvroBytes(value: any): boolean {
  return value instanceof Uint8Array
}

/** A list value: a JS array, or one of cel-es's own list types. Never a map. */
function isCelList(value: any): boolean {
  if (Array.isArray(value)) {
    return true
  }
  return value != null && typeof value === "object" && typeof value.size === "number"
    && typeof value[Symbol.iterator] === "function" && typeof value.entries !== "function"
}

/** A map or record value: cel-es's map types, or a plain object. Never a list. */
function isCelStruct(value: any): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  return typeof value.entries === "function" || !isAvroBytes(value)
}

function isTemporalLogicalType(logicalType: any): boolean {
  return logicalType === "timestamp-millis" || logicalType === "timestamp-micros"
    || logicalType === "timestamp-nanos" || logicalType === "date"
    || logicalType === "time-millis" || logicalType === "time-micros"
    || logicalType === "local-timestamp-millis" || logicalType === "local-timestamp-micros"
}

/**
 * Whether `value` can be written as `branch`, mirroring Java
 * AvroResultWriter.branchAccepts so a union resolves by value rather than by position.
 */
function avroBranchAccepts(branch: any, value: any, named: Map<string, any>): boolean {
  const node = resolveAvroNode(branch, named)
  if (value === null || value === undefined) {
    return isNullBranch(node)
  }
  const typeName = typeof node === "string" ? node : node?.type
  const logicalType = typeof node === "object" ? node?.logicalType : undefined

  // The CEL wrapper types encode to exactly one shape, so they resolve before the plain
  // structural checks below - a Decimal is an object, and would otherwise match a record.
  if (isCelDecimal(value)) {
    return logicalType === "decimal" && (typeName === "bytes" || typeName === "fixed")
  }
  if (isCelTimestamp(value)) {
    return (typeName === "long" || typeName === "int") && isTemporalLogicalType(logicalType)
  }
  // Both shapes a Variant takes, matching celVariantToAvro below: the class, and the
  // confluent.type.Variant message a CEL rule produces (variants.parseJson and friends return
  // a ReflectMessage). Testing only `instanceof` meant a computed Variant fell through to the
  // structural checks and matched any generic `record` branch, so a union listing another
  // record before the logical-variant one resolved to the wrong branch - while the *writer*
  // handled both shapes happily. An asymmetry between what a branch accepts and what the
  // writer can write is exactly what union resolution must not have.
  if (value instanceof Variant || tryReader(value) !== null) {
    return typeName === "record" && logicalType === "variant"
  }

  switch (typeName) {
    case "null":
      return false
    case "boolean":
      return typeof value === "boolean"
    case "int":
      if (typeof value === "bigint") {
        return value >= -2147483648n && value <= 2147483647n
      }
      return typeof value === "number" && Number.isInteger(value)
        && value >= -2147483648 && value <= 2147483647
    case "long":
      return typeof value === "bigint"
        || (typeof value === "number" && Number.isInteger(value))
    case "float":
    case "double":
      // Java's branchAccepts tests `value instanceof Number`, which an integer satisfies too,
      // so a widened CEL int resolves to a float branch declared ahead of a long one.
      return typeof value === "number" || typeof value === "bigint"
    case "string":
      return typeof value === "string"
    case "enum":
      return typeof value === "string" && (node.symbols ?? []).includes(value)
    case "bytes":
      return isAvroBytes(value)
    case "fixed":
      return isAvroBytes(value) && value.length === node.size
    case "array":
      return isCelList(value)
    case "map":
      return isCelStruct(value)
    case "record":
      return isCelStruct(value)
    default:
      return false
  }
}

/**
 * The union branch to write `value` as. Java throws UnresolvedUnionException when no branch
 * accepts; a union with a single non-null branch cannot be mis-selected, so that one is used
 * regardless and any real mismatch is left to the Avro writer to report.
 */
function pickAvroWriteBranch(branches: any[], value: any, named: Map<string, any>): any {
  const match = branches.find((b) => avroBranchAccepts(b, value, named))
  if (match !== undefined) {
    return match
  }
  const nonNull = branches.filter((b) => !isNullBranch(b))
  if (nonNull.length === 1) {
    return nonNull[0]
  }
  throw new Error(
    `cel: transform result does not match any branch of union ${JSON.stringify(branches)}`)
}

function pickAvroUnionBranch(branches: any[], value: any, named: Map<string, any>): any {
  if (value === null) {
    return branches.find(isNullBranch)
  }
  // Read direction: same value-based resolution, but a value that matches nothing falls back
  // to the first non-null branch rather than failing - reading only enriches a value for CEL.
  return branches.find((b) => avroBranchAccepts(b, value, named))
    ?? branches.find((b) => !isNullBranch(b))
}

/**
 * Indexes the root schema together with the schemas its references resolve to. An inline rule
 * declared in a *referenced* schema names a record that the root text does not define, so
 * without the dependencies the lookup failed and the rule saw the raw value.
 */
function collectAvroNamedAll(root: any, depSchemas: readonly string[]): Map<string, any> {
  const named = new Map<string, any>()
  collectAvroNamed(root, named)
  for (const dep of depSchemas) {
    try {
      collectAvroNamed(JSON.parse(dep), named)
    } catch {
      // A dependency that will not parse simply contributes no names.
    }
  }
  return named
}

function resolveAvroNode(node: any, named: Map<string, any>): any {
  if (typeof node === "string" && named.has(node)) {
    return named.get(node)
  }
  return node
}

/**
 * Indexes every named record/enum/fixed definition so a by-name type reference resolves.
 *
 * Nested definitions inherit the enclosing namespace, so a record `Inner` declared inside
 * namespace `a` is `a.Inner` - the fullname avsc reports and the one a field rule is keyed by.
 * Indexing only the bare `name` left those lookups unresolved, and the rule then saw raw
 * decimal bytes instead of a decoded value. The bare name is kept as an alias so a reference
 * written without the namespace still resolves.
 */
function collectAvroNamed(node: any, out: Map<string, any>, ns: string = ""): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectAvroNamed(n, out, ns))
    return
  }
  if (node == null || typeof node !== "object") {
    return
  }
  let childNs = ns
  if ((node.type === "record" || node.type === "enum" || node.type === "fixed") && node.name) {
    const [nodeNs, fullName] = avroFullname(node, ns)
    childNs = nodeNs
    out.set(fullName, node)
    if (!out.has(node.name)) {
      out.set(node.name, node)
    }
  }
  if (node.fields) {
    node.fields.forEach((f: any) => collectAvroNamed(f.type, out, childNs))
  }
  if (node.items) collectAvroNamed(node.items, out, childNs)
  if (node.values) collectAvroNamed(node.values, out, childNs)
}

/**
 * A named type's namespace and fullname. A dotted `name` is already a fullname and any
 * `namespace` attribute on it is ignored, per the Avro spec.
 */
function avroFullname(node: any, ns: string): [string, string] {
  const name: string = node.name
  const dot = name.lastIndexOf(".")
  if (dot >= 0) {
    return [name.substring(0, dot), name]
  }
  const nodeNs: string = node.namespace !== undefined ? node.namespace : ns
  return [nodeNs, nodeNs ? `${nodeNs}.${name}` : name]
}
