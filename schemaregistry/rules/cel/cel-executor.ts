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
      const field = ctx.currentField()
      return field != null
        ? unwrapAvroFieldFromCel(result, field.fullName, ctx.target.schema)
        : unwrapAvroFromCel(result, ctx.target.schema)
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
function wrapAvroForCel(msg: any, schemaStr: string): any {
  let schema: any
  try {
    schema = JSON.parse(schemaStr)
  } catch {
    return msg
  }
  const named = new Map<string, any>()
  collectAvroNamed(schema, named)
  return avroToCel(msg, schema, named)
}

/**
 * Converts one Avro field value for CEL against the field's own schema (located by the field's
 * fully-qualified `record.field` name), so a `CEL_FIELD` rule's `value` binding sees a decimal at
 * its scale / a timestamp in its unit rather than raw bytes. Returns the value unchanged when the
 * schema or field can't be resolved. avsc discards the decimal scale, so it is read from the raw
 * schema JSON here.
 */
export function wrapAvroFieldForCel(fieldValue: any, fullName: string, schemaStr: string): any {
  const resolved = resolveAvroFieldLeaf(fullName, schemaStr)
  if (resolved == null) {
    return fieldValue
  }
  return avroToCel(fieldValue, resolved.leaf, resolved.named)
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
 * value avsc could not encode (half of finding D6). One converter cannot have that gap. The read
 * side has always been shaped this way; this is the write side catching up.
 */
export function unwrapAvroFieldFromCel(result: any, fullName: string, schemaStr: string): any {
  const resolved = resolveAvroFieldLeaf(fullName, schemaStr)
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
export function unwrapAvroFromCel(result: any, schemaStr: string): any {
  let schema: any
  try {
    schema = JSON.parse(schemaStr)
  } catch {
    return result
  }
  const named = new Map<string, any>()
  collectAvroNamed(schema, named)
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
    // A union: pick the branch that can carry the value, skipping the null branch.
    const branch = node.find((b: any) => b !== "null" && b?.type !== "null")
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
      const out: Record<string, any> = {}
      for (const field of node.fields ?? []) {
        if (field.name in entries) {
          out[field.name] = celToAvro(entries[field.name], field.type, named)
        }
      }
      return out
    }
    case "array":
      return Array.isArray(value)
        ? value.map((v) => celToAvro(v, node.items, named))
        : value
    case "map": {
      const entries = celEntries(value)
      if (entries == null) {
        return value
      }
      const out: Record<string, any> = {}
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

/** cel-es returns a NativeMap rather than a plain object; both are flattened to entries here. */
function celEntries(value: any): Record<string, any> | null {
  if (value == null || typeof value !== "object") {
    return null
  }
  if (typeof value.entries === "function") {
    const out: Record<string, any> = {}
    for (const [k, v] of value.entries()) {
      out[String(k)] = v
    }
    return out
  }
  return value as Record<string, any>
}

/**
 * Resolves the leaf schema of the field named by `fullName` (`record.field`) within the root
 * schema. The walk hands a field rule the already-unwrapped element (array item, map value, or
 * union branch), so the leaf is the container's element type, not the container itself.
 */
function resolveAvroFieldLeaf(
  fullName: string,
  schemaStr: string,
): { leaf: any; named: Map<string, any> } | null {
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
  const named = new Map<string, any>()
  collectAvroNamed(schema, named)
  const record = named.get(recordName)
  if (record == null || !Array.isArray(record.fields)) {
    return null
  }
  const field = record.fields.find((f: any) => f.name === fieldName)
  if (field == null) {
    return null
  }
  return { leaf: avroLeafNode(field.type, named), named }
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

function avroToCel(value: any, node: any, named: Map<string, any>): any {
  node = resolveAvroNode(node, named)
  if (value == null || node == null) {
    return value
  }
  if (Array.isArray(node)) {
    // Union: convert against the branch the value took (the common `[null, X]` shape).
    const branch = pickAvroUnionBranch(node, value)
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
      // domain rules entirely (finding D3).
      return avroVariantToCel(value)
  }
  switch (node.type) {
    case "record": {
      const out: Record<string, any> = { ...value }
      for (const field of node.fields ?? []) {
        if (field.name in value) {
          out[field.name] = avroToCel(value[field.name], field.type, named)
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
        out[key] = avroToCel(value[key], node.values, named)
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

function pickAvroUnionBranch(branches: any[], value: any): any {
  if (value === null) {
    return branches.find(isNullBranch)
  }
  return branches.find((b) => !isNullBranch(b))
}

function resolveAvroNode(node: any, named: Map<string, any>): any {
  if (typeof node === "string" && named.has(node)) {
    return named.get(node)
  }
  return node
}

/** Indexes every named record/enum/fixed definition so a by-name type reference resolves. */
function collectAvroNamed(node: any, out: Map<string, any>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectAvroNamed(n, out))
    return
  }
  if (node == null || typeof node !== "object") {
    return
  }
  if ((node.type === "record" || node.type === "enum" || node.type === "fixed") && node.name) {
    out.set(node.name, node)
    if (node.namespace) {
      out.set(`${node.namespace}.${node.name}`, node)
    }
  }
  if (node.fields) {
    node.fields.forEach((f: any) => collectAvroNamed(f.type, out))
  }
  if (node.items) collectAvroNamed(node.items, out)
  if (node.values) collectAvroNamed(node.values, out)
}
