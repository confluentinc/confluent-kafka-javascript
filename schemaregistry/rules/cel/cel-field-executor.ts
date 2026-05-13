import {RuleRegistry} from "../../serde/rule-registry";
import {
  FieldContext,
  FieldRuleExecutor,
  FieldTransform,
  RuleContext,
} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import {CelExecutor, unwrapAvroFieldFromCel, wrapAvroFieldForCel} from "./cel-executor";
import {celFromScalar} from "@bufbuild/cel";
import type {DescField} from "@bufbuild/protobuf";
import type {ScalarValue} from "@bufbuild/protobuf/reflect";

/**
 * The field value as CEL should see it, converted through the field's declared scalar type
 * when the walk supplied the field. celFromScalar is protobuf-es's own bridge for this.
 */
function celScalarValue(fieldCtx: FieldContext, fieldValue: any): any {
  const fd = fieldCtx.fieldDescriptor as DescField | undefined
  if (fd == null || fd.fieldKind !== 'scalar') {
    return fieldValue
  }
  return celFromScalar(fd.scalar, fieldValue as ScalarValue)
}

export class CelFieldExecutor extends FieldRuleExecutor {
  executor: CelExecutor = new CelExecutor()

  static register(): CelFieldExecutor {
    const executor = new CelFieldExecutor()
    RuleRegistry.registerRuleExecutor(executor)
    return executor
  }

  configure(clientConfig: ClientConfig, config: Map<string, string>) {
    this.config = config
  }

  type(): string {
    return "CEL_FIELD"
  }

  override newTransform(ctx: RuleContext): FieldTransform {
    return new CelFieldExecutorTransform(this.executor)
  }

  async close(): Promise<void> {
  }
}

export class CelFieldExecutorTransform implements FieldTransform {
  private executor: CelExecutor

  constructor(executor: CelExecutor) {
    this.executor = executor
  }

  async transform(ctx: RuleContext, fieldCtx: FieldContext, fieldValue: any): Promise<any> {
    if (fieldValue == null) {
      return null
    }
    if (!fieldCtx.isPrimitive()) {
      return fieldValue
    }
    // Bind `value` the way the field's declared type implies. For Protobuf that means converting
    // a scalar through its descriptor (celScalarValue): protobuf-es picks whichever JS type is
    // convenient - a number for an int32, a bigint for both int64 and uint64 - and CEL reads those
    // as double and int, leaving a rule written against the field's own type without a matching
    // overload; FieldType cannot express the difference, so the field itself travels on the
    // context. For Avro it means a decimal/timestamp field arrives as a self-describing
    // Decimal/Timestamp (scale/unit from the schema), matching `decimal(message.field)` and the
    // other clients.
    let value = celScalarValue(fieldCtx, fieldValue)
    if (ctx.target?.schemaType === "AVRO" && ctx.target.schema) {
      value = wrapAvroFieldForCel(fieldValue, fieldCtx.fullName, ctx.target.schema)
    }
    const args = {
      value,
      fullName: fieldCtx.fullName,
      name: fieldCtx.name,
      typeName: fieldCtx.typeName(),
      tags: Array.from(fieldCtx.tags),
      message: fieldCtx.containingMessage
    }
    const result = await this.executor.execute(ctx, fieldValue, args)
    // Encode a returned Decimal/Timestamp back to the field's Avro form (bytes/epoch at the
    // schema scale/unit) so avsc can serialize it; a bool condition result passes through.
    if (ctx.target?.schemaType === "AVRO" && ctx.target.schema) {
      return unwrapAvroFieldFromCel(result, fieldCtx.fullName, ctx.target.schema)
    }
    return result
  }
}
