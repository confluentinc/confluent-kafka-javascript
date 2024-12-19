import {RuleRegistry} from "../../serde/rule-registry";
import {RuleContext, RuleExecutor} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import stringify from "json-stringify-deterministic";
import {LRUCache} from "lru-cache";
import {
  BoolType,
  DoubleType, DynType,
  Env,
  EnvOption, Issues, listType, mapType,
  NullType, objectType, Program,
  StringType,
  Type,
  types,
  variable
} from "@bearclaw/cel";

export class CelExecutor implements RuleExecutor {
  config: Map<string, string> | null = null
  env: Env
  cache: LRUCache<string, Program> = new LRUCache({max: 1000})

  static register(): CelExecutor {
    const executor = new CelExecutor()
    RuleRegistry.registerRuleExecutor(executor)
    return executor
  }

  constructor() {
    this.env = new Env()
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
    const declTypeNames = this.toDeclTypeNames(args)
    const rule: RuleWithArgs = {
      rule: expr,
      scriptType: scriptType,
      declTypeNames: declTypeNames,
      schema: schema
    }
    const ruleJson = stringify(rule)
    let program = this.cache.get(ruleJson)
    if (program == null) {
      const decls = this.toDecls(args)
      const program = this.newProgram(expr, msg, decls)
      this.cache.set(ruleJson, program)
    }
    return this.eval(program!, args)
  }

  toDecls(args: { [key: string]: any }): EnvOption[] {
    let vars = []
    for (let name in args) {
      vars.push(variable(name, this.findType(args[name])))
    }
    return vars
  }

  toDeclTypeNames(args: { [key: string]: any }): Map<string, string> {
    let declTypeNames = new Map()
    for (let name in args) {
      declTypeNames.set(name, this.findType(args[name]).typeName)
    }
    return declTypeNames
  }

  findType(arg: any): Type {
    if (arg == null) {
      return NullType
    }
    const typeName = arg.$typeName
    if (typeName != null) {
      return objectType(typeName)
    }
    return this.typeToCelType(arg)
  }

  typeToCelType(arg: any): Type {
    if (arg == null) {
      return NullType
    }
    const type = typeof arg
    switch (type) {
      case 'boolean':
        return BoolType
      case 'number':
        return DoubleType
      case 'string':
        return StringType
    }
    if (arg instanceof Map) {
      return mapType(DynType, DynType)
    }
    if (Array.isArray(arg)) {
      return listType(DynType)
    }
    return DynType
  }

  newProgram(expr: string, obj: any, decls: EnvOption[]): Program {
    const typeName = obj.$typeName
    let declType = null
    if (typeName != null) {
      declType = types(objectType(typeName))
    }
    /* TODO
    else if typ.Kind() == reflect.Struct {
      declType = ext.NativeTypes(typ)
    }
    */
    let envOptions = decls
    if (declType != null) {
      envOptions.push(declType)
    }
    const env = this.env.extend(...envOptions)
    const ast = env.compile(expr)
    if (ast instanceof Issues) {
      throw new Error(ast.toString())
    }
    const prg = env.program(ast)
    if (prg instanceof Error) {
      throw prg
    }
    return prg
  }

  eval(program: Program, args: { [key: string]: any }): any {
    const [val, details, err] = program.eval(args)
    if (err != null) {
      // TODO fix
      throw Error(err.toString() + ": " + details)
    }
    return val
  }

  async close(): Promise<void> {
  }
}

interface RuleWithArgs {
  rule?: string
  scriptType?: string
  declTypeNames?: Map<string, string>
  schema?: string
}
