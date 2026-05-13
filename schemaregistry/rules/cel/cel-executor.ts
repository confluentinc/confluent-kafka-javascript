import {RuleRegistry} from "../../serde/rule-registry";
import {RuleContext, RuleExecutor} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import stringify from "json-stringify-deterministic";
import {LRUCache} from "lru-cache";
import {CelEnv, celEnv, parse, plan} from "@bufbuild/cel";
import { strings as STRINGS_EXT_FUNCS } from "@bufbuild/cel/ext";
import { DescMessage, fromBinary } from "@bufbuild/protobuf";
import { reflect } from "@bufbuild/protobuf/reflect";
import { FileDescriptorProtoSchema, timestampNow } from "@bufbuild/protobuf/wkt";
import { newFileRegistry } from "../../serde/protobuf";
import { DECIMAL_FUNCS } from "./decimal-funcs";
import { TIMESTAMP_FUNCS } from "./timestamp-funcs";

export class CelExecutor implements RuleExecutor {
  config: Map<string, string> | null = null
  env: CelEnv = celEnv({
    funcs: [...STRINGS_EXT_FUNCS, ...DECIMAL_FUNCS, ...TIMESTAMP_FUNCS],
  });
  cache: LRUCache<string, any> = new LRUCache({max: 1000})
  // Parsed proto descriptors keyed by schema string. Used to wrap raw proto
  // Messages as ReflectMessage before passing to CEL, so @bufbuild/cel's
  // `toCel` skips its WKT-only registry lookup. The wrap is transitive: once
  // the outer message is a ReflectMessage, nested message fields stay as
  // ReflectMessages too (see field.js:reflectMsgToCel), so any non-WKT type
  // reachable through the schema's file descriptor resolves correctly.
  protoDescCache: LRUCache<string, DescMessage> = new LRUCache({max: 1000})

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
   * Wraps a raw proto Message in a ReflectMessage so {@code @bufbuild/cel}
   * recognizes it without a registry lookup. For non-proto targets or when
   * the descriptor cannot be resolved, returns msg unchanged.
   */
  wrapForCel(ctx: RuleContext, msg: any): any {
    if (
      ctx.target?.schemaType !== "PROTOBUF" ||
      msg == null ||
      typeof msg !== "object" ||
      typeof msg.$typeName !== "string" ||
      !ctx.target.schema
    ) {
      return msg
    }
    const typeName: string = msg.$typeName
    const schema: string = ctx.target.schema
    const cacheKey = `${schema}::${typeName}`
    let desc = this.protoDescCache.get(cacheKey)
    if (desc == null) {
      const fileDesc = fromBinary(
        FileDescriptorProtoSchema, Buffer.from(schema, "base64"))
      const fileRegistry = newFileRegistry(fileDesc, new Map())
      const found = fileRegistry.getMessage(typeName)
      if (found == null) {
        return msg
      }
      desc = found
      this.protoDescCache.set(cacheKey, desc)
    }
    return reflect(desc, msg)
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
    const rule: RuleWithArgs = {
      rule: expr,
      scriptType: scriptType,
      schema: schema
    }
    const ruleJson = stringify(rule)
    let program = this.cache.get(ruleJson)
    if (program == null) {
      const parsedExpr = parse(expr)
      program = plan(this.env, parsedExpr)
      this.cache.set(ruleJson, program)
    }
    // `now` is bound lazily, fresh per evaluation. Only inject when the
    // expression references it. Each rule evaluation sees a freshly-captured
    // UTC instant — mirrors the protovalidate / Python pattern.
    if (expr.includes("now") && args["now"] === undefined) {
      args["now"] = timestampNow()
    }
    return program(args)
  }

  async close(): Promise<void> {
  }
}

interface RuleWithArgs {
  rule?: string
  scriptType?: string
  schema?: string
}
