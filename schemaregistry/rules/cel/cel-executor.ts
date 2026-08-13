import {RuleRegistry} from "../../serde/rule-registry";
import {RuleContext, RuleExecutor} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import stringify from "json-stringify-deterministic";
import {LRUCache} from "lru-cache";
import {CelEnv, celEnv, parse, plan} from "@bufbuild/cel";
import { strings } from "@bufbuild/cel/ext";
import type {Registry} from "@bufbuild/protobuf";

export class CelExecutor implements RuleExecutor {
  config: Map<string, string> | null = null
  env: CelEnv = celEnv({ funcs: strings });
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
      message: msg
    }
    return await this.execute(ctx, msg, args)
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
        const guardResult = await this.executeRule(ctx, guard, msg, args)
        if (guardResult === false) {
          // skip the expr
          if (ctx.rule.kind === 'CONDITION') {
            return true
          }
          return msg
        }
      }
      expr = expr.substring(index + 1)
    }
    return await this.executeRule(ctx, expr, msg, args)
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
    return program(args)
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
        env: celEnv({ funcs: strings, registry }),
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
