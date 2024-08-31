import {registerRuleExecutor} from "../../serde/rule-registry";
import {RuleContext, RuleExecutor} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import stringify from "json-stringify-deterministic";
import {LRUCache} from "lru-cache";
import {evaluate, parse, Success} from "cel-js";

export class CelExecutor implements RuleExecutor {
  config: Map<string, string> | null = null
  cache: LRUCache<string, Success> = new LRUCache({max: 1000})

  static register(): CelExecutor {
    const executor = new CelExecutor()
    registerRuleExecutor(executor)
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
    }
    return await this.executeRule(ctx, expr, msg, args)
  }

  async executeRule(ctx: RuleContext, expr: string, obj: any, args: { [key: string]: any }): Promise<any> {
    let msg = obj['message']
    if (msg == null) {
      msg = obj
    }
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
      const parsed = parse(expr)
      if (!parsed.isSuccess) {
        throw new Error(`Failed to parse rule: ${expr}`)
      }
      program = parsed
      this.cache.set(ruleJson, program)
    }
    return evaluate(program.cst, args)
  }

  async close(): Promise<void> {
  }
}

interface RuleWithArgs {
  rule?: string
  scriptType?: string
  declTypeNames?: string[]
  schema?: string
}
