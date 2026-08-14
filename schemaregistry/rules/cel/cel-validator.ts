import { CelEnv, celEnv, celFromScalar, isCelError, parse, plan } from "@bufbuild/cel"
import { strings } from "@bufbuild/cel/ext"
import { createRegistry, DescField, DescFile } from "@bufbuild/protobuf"
import type { ScalarValue } from "@bufbuild/protobuf/reflect"
import { timestampNow } from "@bufbuild/protobuf/wkt"
import { LRUCache } from "lru-cache"
import { RuleError, ValidationRule, ValidationRuleExecutor } from "../../serde/serde"

/**
 * CelValidator is a validation-rule executor backed by CEL. Each rule expression is
 * evaluated with `this` bound to the value being validated and `now` bound to the
 * current time, and must return either a boolean (false = failed) or a string
 * (non-empty = failed, with that string as the failure message).
 *
 * Programs are cached by expression alone — unlike the JVM client, plans carry no
 * static type declarations, so the same plan is reusable across every value shape.
 */
export class CelValidator implements ValidationRuleExecutor {
  env: CelEnv = celEnv({ funcs: strings })
  cache: LRUCache<string, any> = new LRUCache({ max: 1000 })
  // Envs carrying a protobuf registry, one per descriptor file. CEL resolves field
  // access on a protobuf message through its registry, so validating one requires an env
  // that knows the message's type. Keyed by the descriptor file object rather than by
  // its name: two schemas - different subjects, or two versions of one subject - can
  // declare the same .proto filename with different contents, and reusing the first
  // one's registry would resolve fields against the wrong schema. The WeakMap also lets
  // an env be collected with the parsed schema it belongs to.
  protoEnvs: WeakMap<DescFile, ProtoEnv> = new WeakMap()
  private nextProtoEnvId = 1

  async execute(rule: ValidationRule, schema: any, msg: any): Promise<any> {
    const name = rule.name ? rule.name : 'unnamed'
    if (msg == null) {
      // Walkers are expected to enforce skip-on-null before invoking the executor; a
      // null here means a non-compliant caller. Surface the contract violation
      // explicitly rather than trip a confusing CEL evaluation error.
      throw new RuleError(
        `Validation rule '${name}' received a null value; walkers must enforce ` +
        `skip-on-null before invoking the executor.`)
    }
    if (!rule.expr) {
      throw new RuleError(`Validation rule '${name}' has no expression`)
    }

    const { env, id } = this.envFor(schema)
    // A plan is tied to the env it was compiled against, so the env's identity is part
    // of the key.
    const cacheKey = `${id}\0${rule.expr}`
    let program = this.cache.get(cacheKey)
    if (program == null) {
      try {
        program = plan(env, parse(rule.expr))
      } catch (e) {
        throw new RuleError(
          `Could not compile validation rule '${name}': ${(e as Error).message}`)
      }
      this.cache.set(cacheKey, program)
    }

    // CEL returns errors rather than throwing them, so unwrap the result explicitly.
    const result = program({ this: celValue(schema, msg), now: timestampNow() })
    if (isCelError(result)) {
      const detail = rule.doc ? ` (${rule.doc})` : ''
      throw new RuleError(
        `Could not execute validation rule '${name}'${detail}: ${result.message}`)
    }
    if (typeof result === 'boolean' || typeof result === 'string') {
      return result
    }
    throw new RuleError(
      `Validation rule '${name}' must return bool or string; got ${typeof result}`)
  }

  /**
   * Returns the env to evaluate with. Protobuf values need an env whose registry knows
   * their type, so one env is built (and cached) per descriptor file; every other value
   * shape uses the shared registry-less env.
   */
  private envFor(schema: any): ProtoEnv {
    const file = fileOf(schema)
    if (file == null) {
      return { env: this.env, id: '' }
    }
    let protoEnv = this.protoEnvs.get(file)
    if (protoEnv == null) {
      // Register every type the file can reach, not just the one the rule was declared
      // on: the value bound to `this` may be a field's message type, a map value or a
      // list element, and its own fields have to resolve too.
      protoEnv = {
        env: celEnv({ funcs: strings, registry: createRegistry(...filesReachableFrom(file)) }),
        id: String(this.nextProtoEnvId++),
      }
      this.protoEnvs.set(file, protoEnv)
    }
    return protoEnv
  }
}

/**
 * The value to bind to `this`, converted the way the field's declared type implies.
 *
 * protobuf-es represents a scalar with whichever JS type is convenient - a `number` for an
 * int32, a `bigint` for both int64 and uint64 - and CEL reads those as `double` and `int`.
 * A rule authored against the field's own type is then left without a matching overload:
 * `this % 10u == 5u` on a uint field, or `this / 2` on an int32. The field's declared type
 * is what distinguishes them, and it arrives here as the schema argument. celFromScalar is
 * protobuf-es's own bridge for exactly this, and is what protovalidate-es uses.
 */
function celValue(schema: any, msg: any): any {
  if (schema == null || typeof schema !== 'object' || !('fieldKind' in schema)) {
    // A message-level rule: the schema is a DescMessage, and the fields inside resolve
    // through the registry, which already knows their types.
    return msg
  }
  const fd = schema as DescField
  switch (fd.fieldKind) {
    case 'scalar':
      return celFromScalar(fd.scalar, msg as ScalarValue)
    case 'list':
      // A repeated field binds the whole list, so each element needs converting.
      return fd.listKind === 'scalar' && Array.isArray(msg)
        ? msg.map((element) => celFromScalar(fd.scalar, element as ScalarValue))
        : msg
    case 'map':
      if (fd.mapKind !== 'scalar' || msg == null || typeof msg !== 'object') {
        return msg
      }
      return Object.fromEntries(Object.entries(msg).map(
        ([key, value]) => [key, celFromScalar(fd.scalar, value as ScalarValue)]))
    default:
      return msg
  }
}

interface ProtoEnv {
  env: CelEnv
  // Identifies the env within this validator, for keying the program cache.
  id: string
}

/**
 * The descriptor file a rule's schema argument belongs to. Walkers pass the message
 * descriptor for message-level rules and the field descriptor for field-level ones, and
 * a field-level rule on a message, list or map field binds a protobuf value to `this`
 * just the same.
 */
function fileOf(schema: any): DescFile | undefined {
  if (schema == null) {
    return undefined
  }
  if (schema.kind === 'message') {
    return schema.file
  }
  if (schema.kind === 'field') {
    return schema.parent?.file
  }
  return undefined
}

/** The file plus every file it depends on, transitively. */
function filesReachableFrom(file: DescFile): DescFile[] {
  const files: DescFile[] = []
  const seen = new Set<DescFile>()
  const visit = (current: DescFile) => {
    if (seen.has(current)) {
      return
    }
    seen.add(current)
    files.push(current)
    for (const dep of current.dependencies) {
      visit(dep)
    }
  }
  visit(file)
  return files
}
