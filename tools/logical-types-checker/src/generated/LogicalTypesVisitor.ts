
import { AbstractParseTreeVisitor } from "antlr4ng";


import { ScriptContext } from "./LogicalTypesParser.js";
import { DeclareNamespaceStmtContext } from "./LogicalTypesParser.js";
import { TypeAliasStmtContext } from "./LogicalTypesParser.js";
import { TypeRefStmtContext } from "./LogicalTypesParser.js";
import { CreateTypeStmtContext } from "./LogicalTypesParser.js";
import { RegisterTypeStmtContext } from "./LogicalTypesParser.js";
import { StructBodyContext } from "./LogicalTypesParser.js";
import { StructBodyItemContext } from "./LogicalTypesParser.js";
import { FieldDefContext } from "./LogicalTypesParser.js";
import { FieldNameContext } from "./LogicalTypesParser.js";
import { NullabilityContext } from "./LogicalTypesParser.js";
import { DefaultClauseContext } from "./LogicalTypesParser.js";
import { CommentClauseContext } from "./LogicalTypesParser.js";
import { TagsClauseContext } from "./LogicalTypesParser.js";
import { WithClauseContext } from "./LogicalTypesParser.js";
import { WithPropertyContext } from "./LogicalTypesParser.js";
import { ColumnConstraintContext } from "./LogicalTypesParser.js";
import { TableConstraintContext } from "./LogicalTypesParser.js";
import { CheckClauseContext } from "./LogicalTypesParser.js";
import { MessageClauseContext } from "./LogicalTypesParser.js";
import { Check_exprContext } from "./LogicalTypesParser.js";
import { Check_expr_orContext } from "./LogicalTypesParser.js";
import { Check_expr_andContext } from "./LogicalTypesParser.js";
import { CheckExprNotContext } from "./LogicalTypesParser.js";
import { CheckExprNotPassContext } from "./LogicalTypesParser.js";
import { Check_expr_isnullContext } from "./LogicalTypesParser.js";
import { Check_expr_compareContext } from "./LogicalTypesParser.js";
import { Check_expr_betweenContext } from "./LogicalTypesParser.js";
import { Check_expr_inContext } from "./LogicalTypesParser.js";
import { InTargetParenListContext } from "./LogicalTypesParser.js";
import { InTargetExprContext } from "./LogicalTypesParser.js";
import { Check_expr_likeContext } from "./LogicalTypesParser.js";
import { Escape_clauseContext } from "./LogicalTypesParser.js";
import { Check_expr_addContext } from "./LogicalTypesParser.js";
import { Check_expr_mulContext } from "./LogicalTypesParser.js";
import { Check_expr_unary_signContext } from "./LogicalTypesParser.js";
import { CheckFuncContext } from "./LogicalTypesParser.js";
import { CheckColumnRefContext } from "./LogicalTypesParser.js";
import { CheckLiteralContext } from "./LogicalTypesParser.js";
import { CheckParenContext } from "./LogicalTypesParser.js";
import { CheckCaseContext } from "./LogicalTypesParser.js";
import { Func_exprContext } from "./LogicalTypesParser.js";
import { Func_applicationContext } from "./LogicalTypesParser.js";
import { FuncCastContext } from "./LogicalTypesParser.js";
import { FuncExtractContext } from "./LogicalTypesParser.js";
import { FuncSubstringFromForContext } from "./LogicalTypesParser.js";
import { FuncSubstringCommasContext } from "./LogicalTypesParser.js";
import { FuncPositionContext } from "./LogicalTypesParser.js";
import { FuncTrimContext } from "./LogicalTypesParser.js";
import { FuncCurrentTimestampContext } from "./LogicalTypesParser.js";
import { FuncVariantGetContext } from "./LogicalTypesParser.js";
import { FuncTryVariantGetContext } from "./LogicalTypesParser.js";
import { CastTypeContext } from "./LogicalTypesParser.js";
import { Case_exprContext } from "./LogicalTypesParser.js";
import { When_clauseContext } from "./LogicalTypesParser.js";
import { ColumnrefContext } from "./LogicalTypesParser.js";
import { ColidContext } from "./LogicalTypesParser.js";
import { IndirectionContext } from "./LogicalTypesParser.js";
import { Indirection_elContext } from "./LogicalTypesParser.js";
import { Check_expr_listContext } from "./LogicalTypesParser.js";
import { EnumBodyContext } from "./LogicalTypesParser.js";
import { EnumValueContext } from "./LogicalTypesParser.js";
import { PrimitiveTypeExprContext } from "./LogicalTypesParser.js";
import { VariantTypeExprContext } from "./LogicalTypesParser.js";
import { RowTypeExprContext } from "./LogicalTypesParser.js";
import { UnionTypeExprContext } from "./LogicalTypesParser.js";
import { MapTypeExprContext } from "./LogicalTypesParser.js";
import { QualifiedNameExprContext } from "./LogicalTypesParser.js";
import { PrefixArrayContext } from "./LogicalTypesParser.js";
import { PrefixMultisetContext } from "./LogicalTypesParser.js";
import { PostfixArrayContext } from "./LogicalTypesParser.js";
import { PostfixMultisetContext } from "./LogicalTypesParser.js";
import { PrimitiveTypeContext } from "./LogicalTypesParser.js";
import { VariantTypeContext } from "./LogicalTypesParser.js";
import { RowTypeContext } from "./LogicalTypesParser.js";
import { UnionTypeContext } from "./LogicalTypesParser.js";
import { UnionBranchContext } from "./LogicalTypesParser.js";
import { MapTypeContext } from "./LogicalTypesParser.js";
import { QualifiedNameContext } from "./LogicalTypesParser.js";
import { LiteralContext } from "./LogicalTypesParser.js";
import { IntLiteralContext } from "./LogicalTypesParser.js";
import { DecimalLiteralContext } from "./LogicalTypesParser.js";
import { DoubleLiteralContext } from "./LogicalTypesParser.js";
import { StringLiteralContext } from "./LogicalTypesParser.js";
import { BytesLiteralContext } from "./LogicalTypesParser.js";
import { BoolLiteralContext } from "./LogicalTypesParser.js";
import { IdentifierContext } from "./LogicalTypesParser.js";
import { NonReservedKeywordContext } from "./LogicalTypesParser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `LogicalTypesParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class LogicalTypesVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `LogicalTypesParser.script`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScript?: (ctx: ScriptContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.declareNamespaceStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclareNamespaceStmt?: (ctx: DeclareNamespaceStmtContext) => Result;
    /**
     * Visit a parse tree produced by the `typeAliasStmt`
     * labeled alternative in `LogicalTypesParser.aliasStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeAliasStmt?: (ctx: TypeAliasStmtContext) => Result;
    /**
     * Visit a parse tree produced by the `typeRefStmt`
     * labeled alternative in `LogicalTypesParser.aliasStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeRefStmt?: (ctx: TypeRefStmtContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.createTypeStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCreateTypeStmt?: (ctx: CreateTypeStmtContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.registerTypeStmt`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterTypeStmt?: (ctx: RegisterTypeStmtContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.structBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructBody?: (ctx: StructBodyContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.structBodyItem`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructBodyItem?: (ctx: StructBodyItemContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.fieldDef`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldDef?: (ctx: FieldDefContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.fieldName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldName?: (ctx: FieldNameContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.nullability`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNullability?: (ctx: NullabilityContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.defaultClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefaultClause?: (ctx: DefaultClauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.commentClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCommentClause?: (ctx: CommentClauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.tagsClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTagsClause?: (ctx: TagsClauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.withClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWithClause?: (ctx: WithClauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.withProperty`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWithProperty?: (ctx: WithPropertyContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.columnConstraint`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitColumnConstraint?: (ctx: ColumnConstraintContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.tableConstraint`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTableConstraint?: (ctx: TableConstraintContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.checkClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckClause?: (ctx: CheckClauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.messageClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMessageClause?: (ctx: MessageClauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr?: (ctx: Check_exprContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_or`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_or?: (ctx: Check_expr_orContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_and`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_and?: (ctx: Check_expr_andContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckExprNot`
     * labeled alternative in `LogicalTypesParser.check_expr_unary_not`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckExprNot?: (ctx: CheckExprNotContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckExprNotPass`
     * labeled alternative in `LogicalTypesParser.check_expr_unary_not`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckExprNotPass?: (ctx: CheckExprNotPassContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_isnull`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_isnull?: (ctx: Check_expr_isnullContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_compare`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_compare?: (ctx: Check_expr_compareContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_between`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_between?: (ctx: Check_expr_betweenContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_in`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_in?: (ctx: Check_expr_inContext) => Result;
    /**
     * Visit a parse tree produced by the `InTargetParenList`
     * labeled alternative in `LogicalTypesParser.in_target`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInTargetParenList?: (ctx: InTargetParenListContext) => Result;
    /**
     * Visit a parse tree produced by the `InTargetExpr`
     * labeled alternative in `LogicalTypesParser.in_target`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInTargetExpr?: (ctx: InTargetExprContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_like`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_like?: (ctx: Check_expr_likeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.escape_clause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEscape_clause?: (ctx: Escape_clauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_add`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_add?: (ctx: Check_expr_addContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_mul`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_mul?: (ctx: Check_expr_mulContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_unary_sign`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_unary_sign?: (ctx: Check_expr_unary_signContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckFunc`
     * labeled alternative in `LogicalTypesParser.c_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckFunc?: (ctx: CheckFuncContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckColumnRef`
     * labeled alternative in `LogicalTypesParser.c_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckColumnRef?: (ctx: CheckColumnRefContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckLiteral`
     * labeled alternative in `LogicalTypesParser.c_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckLiteral?: (ctx: CheckLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckParen`
     * labeled alternative in `LogicalTypesParser.c_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckParen?: (ctx: CheckParenContext) => Result;
    /**
     * Visit a parse tree produced by the `CheckCase`
     * labeled alternative in `LogicalTypesParser.c_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheckCase?: (ctx: CheckCaseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.func_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunc_expr?: (ctx: Func_exprContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.func_application`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunc_application?: (ctx: Func_applicationContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncCast`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncCast?: (ctx: FuncCastContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncExtract`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncExtract?: (ctx: FuncExtractContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncSubstringFromFor`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncSubstringFromFor?: (ctx: FuncSubstringFromForContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncSubstringCommas`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncSubstringCommas?: (ctx: FuncSubstringCommasContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncPosition`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncPosition?: (ctx: FuncPositionContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncTrim`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncTrim?: (ctx: FuncTrimContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncCurrentTimestamp`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncCurrentTimestamp?: (ctx: FuncCurrentTimestampContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncVariantGet`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncVariantGet?: (ctx: FuncVariantGetContext) => Result;
    /**
     * Visit a parse tree produced by the `FuncTryVariantGet`
     * labeled alternative in `LogicalTypesParser.func_expr_common_subexpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFuncTryVariantGet?: (ctx: FuncTryVariantGetContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.castType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCastType?: (ctx: CastTypeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.case_expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCase_expr?: (ctx: Case_exprContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.when_clause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhen_clause?: (ctx: When_clauseContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.columnref`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitColumnref?: (ctx: ColumnrefContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.colid`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitColid?: (ctx: ColidContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.indirection`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIndirection?: (ctx: IndirectionContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.indirection_el`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIndirection_el?: (ctx: Indirection_elContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.check_expr_list`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCheck_expr_list?: (ctx: Check_expr_listContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.enumBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumBody?: (ctx: EnumBodyContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.enumValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumValue?: (ctx: EnumValueContext) => Result;
    /**
     * Visit a parse tree produced by the `PrimitiveTypeExpr`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimitiveTypeExpr?: (ctx: PrimitiveTypeExprContext) => Result;
    /**
     * Visit a parse tree produced by the `VariantTypeExpr`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariantTypeExpr?: (ctx: VariantTypeExprContext) => Result;
    /**
     * Visit a parse tree produced by the `RowTypeExpr`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRowTypeExpr?: (ctx: RowTypeExprContext) => Result;
    /**
     * Visit a parse tree produced by the `UnionTypeExpr`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnionTypeExpr?: (ctx: UnionTypeExprContext) => Result;
    /**
     * Visit a parse tree produced by the `MapTypeExpr`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMapTypeExpr?: (ctx: MapTypeExprContext) => Result;
    /**
     * Visit a parse tree produced by the `QualifiedNameExpr`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedNameExpr?: (ctx: QualifiedNameExprContext) => Result;
    /**
     * Visit a parse tree produced by the `PrefixArray`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixArray?: (ctx: PrefixArrayContext) => Result;
    /**
     * Visit a parse tree produced by the `PrefixMultiset`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrefixMultiset?: (ctx: PrefixMultisetContext) => Result;
    /**
     * Visit a parse tree produced by the `PostfixArray`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixArray?: (ctx: PostfixArrayContext) => Result;
    /**
     * Visit a parse tree produced by the `PostfixMultiset`
     * labeled alternative in `LogicalTypesParser.typeExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixMultiset?: (ctx: PostfixMultisetContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.primitiveType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimitiveType?: (ctx: PrimitiveTypeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.variantType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariantType?: (ctx: VariantTypeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.rowType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRowType?: (ctx: RowTypeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.unionType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnionType?: (ctx: UnionTypeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.unionBranch`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnionBranch?: (ctx: UnionBranchContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.mapType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMapType?: (ctx: MapTypeContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.qualifiedName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedName?: (ctx: QualifiedNameContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.literal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteral?: (ctx: LiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.intLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIntLiteral?: (ctx: IntLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.decimalLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDecimalLiteral?: (ctx: DecimalLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.doubleLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDoubleLiteral?: (ctx: DoubleLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.stringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStringLiteral?: (ctx: StringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.bytesLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBytesLiteral?: (ctx: BytesLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.boolLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBoolLiteral?: (ctx: BoolLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.identifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdentifier?: (ctx: IdentifierContext) => Result;
    /**
     * Visit a parse tree produced by `LogicalTypesParser.nonReservedKeyword`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonReservedKeyword?: (ctx: NonReservedKeywordContext) => Result;
}

