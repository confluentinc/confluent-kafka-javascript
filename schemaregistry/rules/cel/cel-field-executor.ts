import {RuleRegistry} from "../../serde/rule-registry";
import {
  FieldContext,
  FieldRuleExecutor,
  FieldTransform,
  RuleContext,
} from "../../serde/serde";
import {ClientConfig} from "../../rest-service";
import {CelExecutor, wrapAvroFieldForCel} from "./cel-executor";
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
    // No null guard here, matching the reference: whether an absent value reaches a rule is
    // each format's walk to decide, not the executor's. The protobuf walk skips an unset field
    // before calling this; the Avro walk passes the null branch through so a rule can guard.
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
      // The dependency texts matter as much as the root's: `getInlineTags` collects tags from
      // the referenced schemas too, so a tagged decimal/timestamp field can be *declared* in
      // one. Looking it up in the root alone missed it and the field arrived raw, which is what
      // `decimal(value)` then failed on.
      value = wrapAvroFieldForCel(
        fieldValue, fieldCtx.fullName, ctx.target.schema, ctx.depSchemas ?? [])
    }
    const args = {
      value,
      fullName: fieldCtx.fullName,
      name: fieldCtx.name,
      typeName: fieldCtx.typeName(),
      tags: Array.from(fieldCtx.tags),
      message: fieldCtx.containingMessage
    }
    // execute() encodes the result back to the field's Avro form itself - a returned
    // Decimal/Timestamp to bytes/epoch at the schema's scale/unit - picking the field's schema
    // node off the context. Converting again here would encode it twice, which is what the
    // guard inside writeBack used to be there to prevent.
    return await this.executor.execute(ctx, fieldValue, args)
  }
}
