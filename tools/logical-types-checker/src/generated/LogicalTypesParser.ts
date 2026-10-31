
import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { LogicalTypesVisitor } from "./LogicalTypesVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class LogicalTypesParser extends antlr.Parser {
    public static readonly T__0 = 1;
    public static readonly T__1 = 2;
    public static readonly T__2 = 3;
    public static readonly T__3 = 4;
    public static readonly T__4 = 5;
    public static readonly T__5 = 6;
    public static readonly T__6 = 7;
    public static readonly T__7 = 8;
    public static readonly T__8 = 9;
    public static readonly T__9 = 10;
    public static readonly T__10 = 11;
    public static readonly T__11 = 12;
    public static readonly T__12 = 13;
    public static readonly T__13 = 14;
    public static readonly T__14 = 15;
    public static readonly T__15 = 16;
    public static readonly T__16 = 17;
    public static readonly T__17 = 18;
    public static readonly T__18 = 19;
    public static readonly T__19 = 20;
    public static readonly USING = 21;
    public static readonly AND = 22;
    public static readonly ARRAY = 23;
    public static readonly AS = 24;
    public static readonly BETWEEN = 25;
    public static readonly BIGINT = 26;
    public static readonly BINARY = 27;
    public static readonly BOOLEAN = 28;
    public static readonly BOTH = 29;
    public static readonly BYTES = 30;
    public static readonly CASE = 31;
    public static readonly CAST = 32;
    public static readonly CHARACTER = 33;
    public static readonly CHAR = 34;
    public static readonly CHECK = 35;
    public static readonly COMMENT = 36;
    public static readonly CONSTRAINT = 37;
    public static readonly CURRENT_TIMESTAMP = 38;
    public static readonly DATE = 39;
    public static readonly DEC = 40;
    public static readonly DECIMAL = 41;
    public static readonly DEFAULT = 42;
    public static readonly DOUBLE = 43;
    public static readonly ELSE = 44;
    public static readonly END = 45;
    public static readonly ENUM = 46;
    public static readonly ESCAPE = 47;
    public static readonly EXTRACT = 48;
    public static readonly FALSE = 49;
    public static readonly FLOAT = 50;
    public static readonly FOR = 51;
    public static readonly FROM = 52;
    public static readonly IN = 53;
    public static readonly INT = 54;
    public static readonly INTEGER = 55;
    public static readonly INTERVAL = 56;
    public static readonly IS = 57;
    public static readonly LEADING = 58;
    public static readonly LIKE = 59;
    public static readonly LOCAL = 60;
    public static readonly MAP = 61;
    public static readonly MESSAGE = 62;
    public static readonly MULTISET = 63;
    public static readonly NAMESPACE = 64;
    public static readonly NOT = 65;
    public static readonly NULL = 66;
    public static readonly NUMERIC = 67;
    public static readonly OR = 68;
    public static readonly POSITION = 69;
    public static readonly PRECISION = 70;
    public static readonly REAL = 71;
    public static readonly REF = 72;
    public static readonly RETURNING = 73;
    public static readonly ROW = 74;
    public static readonly STRUCT = 75;
    public static readonly SMALLINT = 76;
    public static readonly STRING = 77;
    public static readonly SUBSTRING = 78;
    public static readonly SYMMETRIC = 79;
    public static readonly TAGS = 80;
    public static readonly THEN = 81;
    public static readonly TIME = 82;
    public static readonly TIMESTAMP_LTZ = 83;
    public static readonly TIMESTAMP = 84;
    public static readonly TINYINT = 85;
    public static readonly TRAILING = 86;
    public static readonly TRIM = 87;
    public static readonly TRUE = 88;
    public static readonly TRY_VARIANT_GET = 89;
    public static readonly TYPE = 90;
    public static readonly UNION = 91;
    public static readonly VARBINARY = 92;
    public static readonly VARCHAR = 93;
    public static readonly VARYING = 94;
    public static readonly VARIANT_GET = 95;
    public static readonly VARIANT = 96;
    public static readonly WHEN = 97;
    public static readonly WITH = 98;
    public static readonly WITHOUT = 99;
    public static readonly ZONE = 100;
    public static readonly INT_LITERAL = 101;
    public static readonly DECIMAL_LITERAL = 102;
    public static readonly DOUBLE_LITERAL = 103;
    public static readonly STRING_LITERAL = 104;
    public static readonly BYTES_LITERAL = 105;
    public static readonly QUOTED_ID = 106;
    public static readonly ID = 107;
    public static readonly WS = 108;
    public static readonly LINE_COMMENT = 109;
    public static readonly BLOCK_COMMENT = 110;
    public static readonly RULE_script = 0;
    public static readonly RULE_declareNamespaceStmt = 1;
    public static readonly RULE_aliasStmt = 2;
    public static readonly RULE_createTypeStmt = 3;
    public static readonly RULE_registerTypeStmt = 4;
    public static readonly RULE_structBody = 5;
    public static readonly RULE_structBodyItem = 6;
    public static readonly RULE_fieldDef = 7;
    public static readonly RULE_fieldName = 8;
    public static readonly RULE_nullability = 9;
    public static readonly RULE_defaultClause = 10;
    public static readonly RULE_commentClause = 11;
    public static readonly RULE_tagsClause = 12;
    public static readonly RULE_withClause = 13;
    public static readonly RULE_withProperty = 14;
    public static readonly RULE_columnConstraint = 15;
    public static readonly RULE_tableConstraint = 16;
    public static readonly RULE_checkClause = 17;
    public static readonly RULE_messageClause = 18;
    public static readonly RULE_check_expr = 19;
    public static readonly RULE_check_expr_or = 20;
    public static readonly RULE_check_expr_and = 21;
    public static readonly RULE_check_expr_unary_not = 22;
    public static readonly RULE_check_expr_isnull = 23;
    public static readonly RULE_check_expr_compare = 24;
    public static readonly RULE_check_expr_between = 25;
    public static readonly RULE_check_expr_in = 26;
    public static readonly RULE_in_target = 27;
    public static readonly RULE_check_expr_like = 28;
    public static readonly RULE_escape_clause = 29;
    public static readonly RULE_check_expr_add = 30;
    public static readonly RULE_check_expr_mul = 31;
    public static readonly RULE_check_expr_unary_sign = 32;
    public static readonly RULE_c_expr = 33;
    public static readonly RULE_func_expr = 34;
    public static readonly RULE_func_application = 35;
    public static readonly RULE_func_expr_common_subexpr = 36;
    public static readonly RULE_castType = 37;
    public static readonly RULE_case_expr = 38;
    public static readonly RULE_when_clause = 39;
    public static readonly RULE_columnref = 40;
    public static readonly RULE_colid = 41;
    public static readonly RULE_indirection = 42;
    public static readonly RULE_indirection_el = 43;
    public static readonly RULE_check_expr_list = 44;
    public static readonly RULE_enumBody = 45;
    public static readonly RULE_enumValue = 46;
    public static readonly RULE_typeExpr = 47;
    public static readonly RULE_primitiveType = 48;
    public static readonly RULE_variantType = 49;
    public static readonly RULE_rowType = 50;
    public static readonly RULE_unionType = 51;
    public static readonly RULE_unionBranch = 52;
    public static readonly RULE_mapType = 53;
    public static readonly RULE_qualifiedName = 54;
    public static readonly RULE_literal = 55;
    public static readonly RULE_intLiteral = 56;
    public static readonly RULE_decimalLiteral = 57;
    public static readonly RULE_doubleLiteral = 58;
    public static readonly RULE_stringLiteral = 59;
    public static readonly RULE_bytesLiteral = 60;
    public static readonly RULE_boolLiteral = 61;
    public static readonly RULE_identifier = 62;
    public static readonly RULE_nonReservedKeyword = 63;

    public static readonly literalNames = [
        null, "';'", "'('", "','", "')'", "'='", "'<>'", "'!='", "'<'", 
        "'<='", "'>'", "'>='", "'+'", "'-'", "'*'", "'/'", "'%'", "'||'", 
        "'.'", "'['", "']'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, "USING", 
        "AND", "ARRAY", "AS", "BETWEEN", "BIGINT", "BINARY", "BOOLEAN", 
        "BOTH", "BYTES", "CASE", "CAST", "CHARACTER", "CHAR", "CHECK", "COMMENT", 
        "CONSTRAINT", "CURRENT_TIMESTAMP", "DATE", "DEC", "DECIMAL", "DEFAULT", 
        "DOUBLE", "ELSE", "END", "ENUM", "ESCAPE", "EXTRACT", "FALSE", "FLOAT", 
        "FOR", "FROM", "IN", "INT", "INTEGER", "INTERVAL", "IS", "LEADING", 
        "LIKE", "LOCAL", "MAP", "MESSAGE", "MULTISET", "NAMESPACE", "NOT", 
        "NULL", "NUMERIC", "OR", "POSITION", "PRECISION", "REAL", "REF", 
        "RETURNING", "ROW", "STRUCT", "SMALLINT", "STRING", "SUBSTRING", 
        "SYMMETRIC", "TAGS", "THEN", "TIME", "TIMESTAMP_LTZ", "TIMESTAMP", 
        "TINYINT", "TRAILING", "TRIM", "TRUE", "TRY_VARIANT_GET", "TYPE", 
        "UNION", "VARBINARY", "VARCHAR", "VARYING", "VARIANT_GET", "VARIANT", 
        "WHEN", "WITH", "WITHOUT", "ZONE", "INT_LITERAL", "DECIMAL_LITERAL", 
        "DOUBLE_LITERAL", "STRING_LITERAL", "BYTES_LITERAL", "QUOTED_ID", 
        "ID", "WS", "LINE_COMMENT", "BLOCK_COMMENT"
    ];
    public static readonly ruleNames = [
        "script", "declareNamespaceStmt", "aliasStmt", "createTypeStmt", 
        "registerTypeStmt", "structBody", "structBodyItem", "fieldDef", 
        "fieldName", "nullability", "defaultClause", "commentClause", "tagsClause", 
        "withClause", "withProperty", "columnConstraint", "tableConstraint", 
        "checkClause", "messageClause", "check_expr", "check_expr_or", "check_expr_and", 
        "check_expr_unary_not", "check_expr_isnull", "check_expr_compare", 
        "check_expr_between", "check_expr_in", "in_target", "check_expr_like", 
        "escape_clause", "check_expr_add", "check_expr_mul", "check_expr_unary_sign", 
        "c_expr", "func_expr", "func_application", "func_expr_common_subexpr", 
        "castType", "case_expr", "when_clause", "columnref", "colid", "indirection", 
        "indirection_el", "check_expr_list", "enumBody", "enumValue", "typeExpr", 
        "primitiveType", "variantType", "rowType", "unionType", "unionBranch", 
        "mapType", "qualifiedName", "literal", "intLiteral", "decimalLiteral", 
        "doubleLiteral", "stringLiteral", "bytesLiteral", "boolLiteral", 
        "identifier", "nonReservedKeyword",
    ];

    public get grammarFileName(): string { return "LogicalTypes.g4"; }
    public get literalNames(): (string | null)[] { return LogicalTypesParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return LogicalTypesParser.symbolicNames; }
    public get ruleNames(): string[] { return LogicalTypesParser.ruleNames; }
    public get serializedATN(): number[] { return LogicalTypesParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, LogicalTypesParser._ATN, LogicalTypesParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public script(): ScriptContext {
        let localContext = new ScriptContext(this.context, this.state);
        this.enterRule(localContext, 0, LogicalTypesParser.RULE_script);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 131;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 64) {
                {
                this.state = 128;
                this.declareNamespaceStmt();
                this.state = 129;
                this.match(LogicalTypesParser.T__0);
                }
            }

            this.state = 138;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 21) {
                {
                {
                this.state = 133;
                this.aliasStmt();
                this.state = 134;
                this.match(LogicalTypesParser.T__0);
                }
                }
                this.state = 140;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 152;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 805306369) !== 0)) {
                {
                this.state = 141;
                this.createTypeStmt();
                this.state = 146;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 2, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 142;
                        this.match(LogicalTypesParser.T__0);
                        this.state = 143;
                        this.createTypeStmt();
                        }
                        }
                    }
                    this.state = 148;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 2, this.context);
                }
                this.state = 150;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 1) {
                    {
                    this.state = 149;
                    this.match(LogicalTypesParser.T__0);
                    }
                }

                }
            }

            this.state = 158;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 90) {
                {
                this.state = 154;
                this.registerTypeStmt();
                this.state = 156;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 1) {
                    {
                    this.state = 155;
                    this.match(LogicalTypesParser.T__0);
                    }
                }

                }
            }

            this.state = 160;
            this.match(LogicalTypesParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declareNamespaceStmt(): DeclareNamespaceStmtContext {
        let localContext = new DeclareNamespaceStmtContext(this.context, this.state);
        this.enterRule(localContext, 2, LogicalTypesParser.RULE_declareNamespaceStmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 162;
            this.match(LogicalTypesParser.NAMESPACE);
            this.state = 163;
            this.qualifiedName();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public aliasStmt(): AliasStmtContext {
        let localContext = new AliasStmtContext(this.context, this.state);
        this.enterRule(localContext, 4, LogicalTypesParser.RULE_aliasStmt);
        try {
            this.state = 181;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 8, this.context) ) {
            case 1:
                localContext = new TypeAliasStmtContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 165;
                this.match(LogicalTypesParser.USING);
                this.state = 166;
                this.match(LogicalTypesParser.TYPE);
                this.state = 167;
                this.qualifiedName();
                this.state = 168;
                this.match(LogicalTypesParser.FOR);
                this.state = 170;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 7, this.context) ) {
                case 1:
                    {
                    this.state = 169;
                    this.match(LogicalTypesParser.TYPE);
                    }
                    break;
                }
                this.state = 172;
                this.qualifiedName();
                }
                break;
            case 2:
                localContext = new TypeRefStmtContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 174;
                this.match(LogicalTypesParser.USING);
                this.state = 175;
                this.match(LogicalTypesParser.TYPE);
                this.state = 176;
                this.qualifiedName();
                this.state = 177;
                this.match(LogicalTypesParser.FOR);
                this.state = 178;
                this.match(LogicalTypesParser.REF);
                this.state = 179;
                this.stringLiteral();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public createTypeStmt(): CreateTypeStmtContext {
        let localContext = new CreateTypeStmtContext(this.context, this.state);
        this.enterRule(localContext, 6, LogicalTypesParser.RULE_createTypeStmt);
        let _la: number;
        try {
            this.state = 204;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.ROW:
            case LogicalTypesParser.STRUCT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 183;
                _la = this.tokenStream.LA(1);
                if(!(_la === 74 || _la === 75)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 184;
                this.qualifiedName();
                this.state = 185;
                this.structBody();
                this.state = 187;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 36 || _la === 104) {
                    {
                    this.state = 186;
                    this.commentClause();
                    }
                }

                this.state = 190;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 80) {
                    {
                    this.state = 189;
                    this.tagsClause();
                    }
                }

                this.state = 193;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 98) {
                    {
                    this.state = 192;
                    this.withClause();
                    }
                }

                }
                break;
            case LogicalTypesParser.ENUM:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 195;
                this.match(LogicalTypesParser.ENUM);
                this.state = 196;
                this.qualifiedName();
                this.state = 197;
                this.enumBody();
                this.state = 199;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 36 || _la === 104) {
                    {
                    this.state = 198;
                    this.commentClause();
                    }
                }

                this.state = 202;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 98) {
                    {
                    this.state = 201;
                    this.withClause();
                    }
                }

                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public registerTypeStmt(): RegisterTypeStmtContext {
        let localContext = new RegisterTypeStmtContext(this.context, this.state);
        this.enterRule(localContext, 8, LogicalTypesParser.RULE_registerTypeStmt);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 206;
            this.match(LogicalTypesParser.TYPE);
            this.state = 207;
            this.typeExpr(0);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structBody(): StructBodyContext {
        let localContext = new StructBodyContext(this.context, this.state);
        this.enterRule(localContext, 10, LogicalTypesParser.RULE_structBody);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 209;
            this.match(LogicalTypesParser.T__1);
            this.state = 210;
            this.structBodyItem();
            this.state = 215;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 211;
                this.match(LogicalTypesParser.T__2);
                this.state = 212;
                this.structBodyItem();
                }
                }
                this.state = 217;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 218;
            this.match(LogicalTypesParser.T__3);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structBodyItem(): StructBodyItemContext {
        let localContext = new StructBodyItemContext(this.context, this.state);
        this.enterRule(localContext, 12, LogicalTypesParser.RULE_structBodyItem);
        try {
            this.state = 222;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.ENUM:
            case LogicalTypesParser.INTERVAL:
            case LogicalTypesParser.MAP:
            case LogicalTypesParser.NAMESPACE:
            case LogicalTypesParser.REF:
            case LogicalTypesParser.TAGS:
            case LogicalTypesParser.TYPE:
            case LogicalTypesParser.VARIANT:
            case LogicalTypesParser.ZONE:
            case LogicalTypesParser.QUOTED_ID:
            case LogicalTypesParser.ID:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 220;
                this.fieldDef();
                }
                break;
            case LogicalTypesParser.CHECK:
            case LogicalTypesParser.CONSTRAINT:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 221;
                this.tableConstraint();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fieldDef(): FieldDefContext {
        let localContext = new FieldDefContext(this.context, this.state);
        this.enterRule(localContext, 14, LogicalTypesParser.RULE_fieldDef);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 224;
            this.fieldName();
            this.state = 225;
            this.typeExpr(0);
            this.state = 227;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 42) {
                {
                this.state = 226;
                this.defaultClause();
                }
            }

            this.state = 232;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 35 || _la === 37) {
                {
                {
                this.state = 229;
                this.columnConstraint();
                }
                }
                this.state = 234;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 236;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36 || _la === 104) {
                {
                this.state = 235;
                this.commentClause();
                }
            }

            this.state = 239;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 80) {
                {
                this.state = 238;
                this.tagsClause();
                }
            }

            this.state = 242;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 241;
                this.withClause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public fieldName(): FieldNameContext {
        let localContext = new FieldNameContext(this.context, this.state);
        this.enterRule(localContext, 16, LogicalTypesParser.RULE_fieldName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 244;
            this.identifier();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public nullability(): NullabilityContext {
        let localContext = new NullabilityContext(this.context, this.state);
        this.enterRule(localContext, 18, LogicalTypesParser.RULE_nullability);
        try {
            this.state = 249;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.NULL:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 246;
                this.match(LogicalTypesParser.NULL);
                }
                break;
            case LogicalTypesParser.NOT:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 247;
                this.match(LogicalTypesParser.NOT);
                this.state = 248;
                this.match(LogicalTypesParser.NULL);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public defaultClause(): DefaultClauseContext {
        let localContext = new DefaultClauseContext(this.context, this.state);
        this.enterRule(localContext, 20, LogicalTypesParser.RULE_defaultClause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 251;
            this.match(LogicalTypesParser.DEFAULT);
            this.state = 252;
            this.literal();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public commentClause(): CommentClauseContext {
        let localContext = new CommentClauseContext(this.context, this.state);
        this.enterRule(localContext, 22, LogicalTypesParser.RULE_commentClause);
        try {
            this.state = 257;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.COMMENT:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 254;
                this.match(LogicalTypesParser.COMMENT);
                this.state = 255;
                this.stringLiteral();
                }
                break;
            case LogicalTypesParser.STRING_LITERAL:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 256;
                this.stringLiteral();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public tagsClause(): TagsClauseContext {
        let localContext = new TagsClauseContext(this.context, this.state);
        this.enterRule(localContext, 24, LogicalTypesParser.RULE_tagsClause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 259;
            this.match(LogicalTypesParser.TAGS);
            this.state = 260;
            this.match(LogicalTypesParser.T__1);
            this.state = 261;
            this.stringLiteral();
            this.state = 266;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 262;
                this.match(LogicalTypesParser.T__2);
                this.state = 263;
                this.stringLiteral();
                }
                }
                this.state = 268;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 269;
            this.match(LogicalTypesParser.T__3);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public withClause(): WithClauseContext {
        let localContext = new WithClauseContext(this.context, this.state);
        this.enterRule(localContext, 26, LogicalTypesParser.RULE_withClause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 271;
            this.match(LogicalTypesParser.WITH);
            this.state = 272;
            this.match(LogicalTypesParser.T__1);
            this.state = 273;
            this.withProperty();
            this.state = 278;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 274;
                this.match(LogicalTypesParser.T__2);
                this.state = 275;
                this.withProperty();
                }
                }
                this.state = 280;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 281;
            this.match(LogicalTypesParser.T__3);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public withProperty(): WithPropertyContext {
        let localContext = new WithPropertyContext(this.context, this.state);
        this.enterRule(localContext, 28, LogicalTypesParser.RULE_withProperty);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 283;
            this.stringLiteral();
            this.state = 284;
            this.match(LogicalTypesParser.T__4);
            this.state = 285;
            this.stringLiteral();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public columnConstraint(): ColumnConstraintContext {
        let localContext = new ColumnConstraintContext(this.context, this.state);
        this.enterRule(localContext, 30, LogicalTypesParser.RULE_columnConstraint);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 287;
            this.checkClause();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public tableConstraint(): TableConstraintContext {
        let localContext = new TableConstraintContext(this.context, this.state);
        this.enterRule(localContext, 32, LogicalTypesParser.RULE_tableConstraint);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 289;
            this.checkClause();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public checkClause(): CheckClauseContext {
        let localContext = new CheckClauseContext(this.context, this.state);
        this.enterRule(localContext, 34, LogicalTypesParser.RULE_checkClause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 293;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 37) {
                {
                this.state = 291;
                this.match(LogicalTypesParser.CONSTRAINT);
                this.state = 292;
                this.identifier();
                }
            }

            this.state = 295;
            this.match(LogicalTypesParser.CHECK);
            this.state = 296;
            this.match(LogicalTypesParser.T__1);
            this.state = 297;
            this.check_expr();
            this.state = 298;
            this.match(LogicalTypesParser.T__3);
            this.state = 300;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 62) {
                {
                this.state = 299;
                this.messageClause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public messageClause(): MessageClauseContext {
        let localContext = new MessageClauseContext(this.context, this.state);
        this.enterRule(localContext, 36, LogicalTypesParser.RULE_messageClause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 302;
            this.match(LogicalTypesParser.MESSAGE);
            this.state = 303;
            this.stringLiteral();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr(): Check_exprContext {
        let localContext = new Check_exprContext(this.context, this.state);
        this.enterRule(localContext, 38, LogicalTypesParser.RULE_check_expr);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 305;
            this.check_expr_or();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_or(): Check_expr_orContext {
        let localContext = new Check_expr_orContext(this.context, this.state);
        this.enterRule(localContext, 40, LogicalTypesParser.RULE_check_expr_or);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 307;
            this.check_expr_and();
            this.state = 312;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 68) {
                {
                {
                this.state = 308;
                this.match(LogicalTypesParser.OR);
                this.state = 309;
                this.check_expr_and();
                }
                }
                this.state = 314;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_and(): Check_expr_andContext {
        let localContext = new Check_expr_andContext(this.context, this.state);
        this.enterRule(localContext, 42, LogicalTypesParser.RULE_check_expr_and);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 315;
            this.check_expr_unary_not();
            this.state = 320;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 22) {
                {
                {
                this.state = 316;
                this.match(LogicalTypesParser.AND);
                this.state = 317;
                this.check_expr_unary_not();
                }
                }
                this.state = 322;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_unary_not(): Check_expr_unary_notContext {
        let localContext = new Check_expr_unary_notContext(this.context, this.state);
        this.enterRule(localContext, 44, LogicalTypesParser.RULE_check_expr_unary_not);
        try {
            this.state = 326;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.NOT:
                localContext = new CheckExprNotContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 323;
                this.match(LogicalTypesParser.NOT);
                this.state = 324;
                this.check_expr_unary_not();
                }
                break;
            case LogicalTypesParser.T__1:
            case LogicalTypesParser.T__11:
            case LogicalTypesParser.T__12:
            case LogicalTypesParser.CASE:
            case LogicalTypesParser.CAST:
            case LogicalTypesParser.CURRENT_TIMESTAMP:
            case LogicalTypesParser.ENUM:
            case LogicalTypesParser.EXTRACT:
            case LogicalTypesParser.FALSE:
            case LogicalTypesParser.INTERVAL:
            case LogicalTypesParser.MAP:
            case LogicalTypesParser.NAMESPACE:
            case LogicalTypesParser.NULL:
            case LogicalTypesParser.POSITION:
            case LogicalTypesParser.REF:
            case LogicalTypesParser.SUBSTRING:
            case LogicalTypesParser.TAGS:
            case LogicalTypesParser.TIMESTAMP:
            case LogicalTypesParser.TRIM:
            case LogicalTypesParser.TRUE:
            case LogicalTypesParser.TRY_VARIANT_GET:
            case LogicalTypesParser.TYPE:
            case LogicalTypesParser.VARIANT_GET:
            case LogicalTypesParser.VARIANT:
            case LogicalTypesParser.ZONE:
            case LogicalTypesParser.INT_LITERAL:
            case LogicalTypesParser.DECIMAL_LITERAL:
            case LogicalTypesParser.DOUBLE_LITERAL:
            case LogicalTypesParser.STRING_LITERAL:
            case LogicalTypesParser.BYTES_LITERAL:
            case LogicalTypesParser.QUOTED_ID:
            case LogicalTypesParser.ID:
                localContext = new CheckExprNotPassContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 325;
                this.check_expr_isnull();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_isnull(): Check_expr_isnullContext {
        let localContext = new Check_expr_isnullContext(this.context, this.state);
        this.enterRule(localContext, 46, LogicalTypesParser.RULE_check_expr_isnull);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 328;
            this.check_expr_compare();
            this.state = 334;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 57) {
                {
                this.state = 329;
                this.match(LogicalTypesParser.IS);
                this.state = 331;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 65) {
                    {
                    this.state = 330;
                    this.match(LogicalTypesParser.NOT);
                    }
                }

                this.state = 333;
                this.match(LogicalTypesParser.NULL);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_compare(): Check_expr_compareContext {
        let localContext = new Check_expr_compareContext(this.context, this.state);
        this.enterRule(localContext, 48, LogicalTypesParser.RULE_check_expr_compare);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 336;
            this.check_expr_between();
            this.state = 339;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4064) !== 0)) {
                {
                this.state = 337;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 4064) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 338;
                this.check_expr_between();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_between(): Check_expr_betweenContext {
        let localContext = new Check_expr_betweenContext(this.context, this.state);
        this.enterRule(localContext, 50, LogicalTypesParser.RULE_check_expr_between);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 341;
            this.check_expr_in();
            this.state = 353;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 25 || _la === 65) {
                {
                this.state = 343;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 65) {
                    {
                    this.state = 342;
                    this.match(LogicalTypesParser.NOT);
                    }
                }

                this.state = 345;
                this.match(LogicalTypesParser.BETWEEN);
                this.state = 347;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 79) {
                    {
                    this.state = 346;
                    this.match(LogicalTypesParser.SYMMETRIC);
                    }
                }

                this.state = 349;
                this.check_expr_in();
                this.state = 350;
                this.match(LogicalTypesParser.AND);
                this.state = 351;
                this.check_expr_in();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_in(): Check_expr_inContext {
        let localContext = new Check_expr_inContext(this.context, this.state);
        this.enterRule(localContext, 52, LogicalTypesParser.RULE_check_expr_in);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 355;
            this.check_expr_like();
            this.state = 361;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                {
                this.state = 357;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 65) {
                    {
                    this.state = 356;
                    this.match(LogicalTypesParser.NOT);
                    }
                }

                this.state = 359;
                this.match(LogicalTypesParser.IN);
                this.state = 360;
                this.in_target();
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public in_target(): In_targetContext {
        let localContext = new In_targetContext(this.context, this.state);
        this.enterRule(localContext, 54, LogicalTypesParser.RULE_in_target);
        try {
            this.state = 368;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 39, this.context) ) {
            case 1:
                localContext = new InTargetParenListContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 363;
                this.match(LogicalTypesParser.T__1);
                this.state = 364;
                this.check_expr_list();
                this.state = 365;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 2:
                localContext = new InTargetExprContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 367;
                this.check_expr_like();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_like(): Check_expr_likeContext {
        let localContext = new Check_expr_likeContext(this.context, this.state);
        this.enterRule(localContext, 56, LogicalTypesParser.RULE_check_expr_like);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 370;
            this.check_expr_add();
            this.state = 379;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 42, this.context) ) {
            case 1:
                {
                this.state = 372;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 65) {
                    {
                    this.state = 371;
                    this.match(LogicalTypesParser.NOT);
                    }
                }

                this.state = 374;
                this.match(LogicalTypesParser.LIKE);
                this.state = 375;
                this.stringLiteral();
                this.state = 377;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 47) {
                    {
                    this.state = 376;
                    this.escape_clause();
                    }
                }

                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public escape_clause(): Escape_clauseContext {
        let localContext = new Escape_clauseContext(this.context, this.state);
        this.enterRule(localContext, 58, LogicalTypesParser.RULE_escape_clause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 381;
            this.match(LogicalTypesParser.ESCAPE);
            this.state = 382;
            this.stringLiteral();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_add(): Check_expr_addContext {
        let localContext = new Check_expr_addContext(this.context, this.state);
        this.enterRule(localContext, 60, LogicalTypesParser.RULE_check_expr_add);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 384;
            this.check_expr_mul();
            this.state = 389;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 12 || _la === 13) {
                {
                {
                this.state = 385;
                _la = this.tokenStream.LA(1);
                if(!(_la === 12 || _la === 13)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 386;
                this.check_expr_mul();
                }
                }
                this.state = 391;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_mul(): Check_expr_mulContext {
        let localContext = new Check_expr_mulContext(this.context, this.state);
        this.enterRule(localContext, 62, LogicalTypesParser.RULE_check_expr_mul);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 392;
            this.check_expr_unary_sign();
            this.state = 397;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 245760) !== 0)) {
                {
                {
                this.state = 393;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 245760) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 394;
                this.check_expr_unary_sign();
                }
                }
                this.state = 399;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_unary_sign(): Check_expr_unary_signContext {
        let localContext = new Check_expr_unary_signContext(this.context, this.state);
        this.enterRule(localContext, 64, LogicalTypesParser.RULE_check_expr_unary_sign);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 401;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 45, this.context) ) {
            case 1:
                {
                this.state = 400;
                _la = this.tokenStream.LA(1);
                if(!(_la === 12 || _la === 13)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                }
                break;
            }
            this.state = 403;
            this.c_expr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public c_expr(): C_exprContext {
        let localContext = new C_exprContext(this.context, this.state);
        this.enterRule(localContext, 66, LogicalTypesParser.RULE_c_expr);
        let _la: number;
        try {
            this.state = 415;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 47, this.context) ) {
            case 1:
                localContext = new CheckFuncContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 405;
                this.func_expr();
                }
                break;
            case 2:
                localContext = new CheckColumnRefContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 406;
                this.columnref();
                }
                break;
            case 3:
                localContext = new CheckLiteralContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 407;
                this.literal();
                }
                break;
            case 4:
                localContext = new CheckParenContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 408;
                this.match(LogicalTypesParser.T__1);
                this.state = 409;
                this.check_expr();
                this.state = 410;
                this.match(LogicalTypesParser.T__3);
                this.state = 412;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 18 || _la === 19) {
                    {
                    this.state = 411;
                    this.indirection();
                    }
                }

                }
                break;
            case 5:
                localContext = new CheckCaseContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 414;
                this.case_expr();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public func_expr(): Func_exprContext {
        let localContext = new Func_exprContext(this.context, this.state);
        this.enterRule(localContext, 68, LogicalTypesParser.RULE_func_expr);
        try {
            this.state = 419;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.CAST:
            case LogicalTypesParser.CURRENT_TIMESTAMP:
            case LogicalTypesParser.EXTRACT:
            case LogicalTypesParser.POSITION:
            case LogicalTypesParser.SUBSTRING:
            case LogicalTypesParser.TRIM:
            case LogicalTypesParser.TRY_VARIANT_GET:
            case LogicalTypesParser.VARIANT_GET:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 417;
                this.func_expr_common_subexpr();
                }
                break;
            case LogicalTypesParser.ENUM:
            case LogicalTypesParser.INTERVAL:
            case LogicalTypesParser.MAP:
            case LogicalTypesParser.NAMESPACE:
            case LogicalTypesParser.REF:
            case LogicalTypesParser.TAGS:
            case LogicalTypesParser.TYPE:
            case LogicalTypesParser.VARIANT:
            case LogicalTypesParser.ZONE:
            case LogicalTypesParser.QUOTED_ID:
            case LogicalTypesParser.ID:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 418;
                this.func_application();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public func_application(): Func_applicationContext {
        let localContext = new Func_applicationContext(this.context, this.state);
        this.enterRule(localContext, 70, LogicalTypesParser.RULE_func_application);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 421;
            this.identifier();
            this.state = 422;
            this.match(LogicalTypesParser.T__1);
            this.state = 424;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2147495940) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 553861185) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2274443559) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4081) !== 0)) {
                {
                this.state = 423;
                this.check_expr_list();
                }
            }

            this.state = 426;
            this.match(LogicalTypesParser.T__3);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public func_expr_common_subexpr(): Func_expr_common_subexprContext {
        let localContext = new Func_expr_common_subexprContext(this.context, this.state);
        this.enterRule(localContext, 72, LogicalTypesParser.RULE_func_expr_common_subexpr);
        let _la: number;
        try {
            this.state = 508;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 56, this.context) ) {
            case 1:
                localContext = new FuncCastContext(localContext);
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 428;
                this.match(LogicalTypesParser.CAST);
                this.state = 429;
                this.match(LogicalTypesParser.T__1);
                this.state = 430;
                this.check_expr();
                this.state = 431;
                this.match(LogicalTypesParser.AS);
                this.state = 432;
                this.castType();
                this.state = 433;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 2:
                localContext = new FuncExtractContext(localContext);
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 435;
                this.match(LogicalTypesParser.EXTRACT);
                this.state = 436;
                this.match(LogicalTypesParser.T__1);
                this.state = 437;
                this.identifier();
                this.state = 438;
                this.match(LogicalTypesParser.FROM);
                this.state = 439;
                this.check_expr();
                this.state = 440;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 3:
                localContext = new FuncSubstringFromForContext(localContext);
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 442;
                this.match(LogicalTypesParser.SUBSTRING);
                this.state = 443;
                this.match(LogicalTypesParser.T__1);
                this.state = 444;
                this.check_expr();
                this.state = 445;
                this.match(LogicalTypesParser.FROM);
                this.state = 446;
                this.check_expr();
                this.state = 449;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 51) {
                    {
                    this.state = 447;
                    this.match(LogicalTypesParser.FOR);
                    this.state = 448;
                    this.check_expr();
                    }
                }

                this.state = 451;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 4:
                localContext = new FuncSubstringCommasContext(localContext);
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 453;
                this.match(LogicalTypesParser.SUBSTRING);
                this.state = 454;
                this.match(LogicalTypesParser.T__1);
                this.state = 455;
                this.check_expr();
                this.state = 456;
                this.match(LogicalTypesParser.T__2);
                this.state = 457;
                this.check_expr();
                this.state = 460;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 3) {
                    {
                    this.state = 458;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 459;
                    this.check_expr();
                    }
                }

                this.state = 462;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 5:
                localContext = new FuncPositionContext(localContext);
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 464;
                this.match(LogicalTypesParser.POSITION);
                this.state = 465;
                this.match(LogicalTypesParser.T__1);
                this.state = 466;
                this.c_expr();
                this.state = 467;
                this.match(LogicalTypesParser.IN);
                this.state = 468;
                this.check_expr();
                this.state = 471;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 52) {
                    {
                    this.state = 469;
                    this.match(LogicalTypesParser.FROM);
                    this.state = 470;
                    this.check_expr();
                    }
                }

                this.state = 473;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 6:
                localContext = new FuncTrimContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 475;
                this.match(LogicalTypesParser.TRIM);
                this.state = 476;
                this.match(LogicalTypesParser.T__1);
                this.state = 478;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 29 || _la === 58 || _la === 86) {
                    {
                    this.state = 477;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 29 || _la === 58 || _la === 86)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                }

                this.state = 480;
                this.check_expr();
                this.state = 483;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 52) {
                    {
                    this.state = 481;
                    this.match(LogicalTypesParser.FROM);
                    this.state = 482;
                    this.check_expr();
                    }
                }

                this.state = 485;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 7:
                localContext = new FuncCurrentTimestampContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 487;
                this.match(LogicalTypesParser.CURRENT_TIMESTAMP);
                }
                break;
            case 8:
                localContext = new FuncVariantGetContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 488;
                this.match(LogicalTypesParser.VARIANT_GET);
                this.state = 489;
                this.match(LogicalTypesParser.T__1);
                this.state = 490;
                this.check_expr();
                this.state = 491;
                this.match(LogicalTypesParser.T__2);
                this.state = 492;
                this.check_expr();
                this.state = 495;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 73) {
                    {
                    this.state = 493;
                    this.match(LogicalTypesParser.RETURNING);
                    this.state = 494;
                    this.castType();
                    }
                }

                this.state = 497;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 9:
                localContext = new FuncTryVariantGetContext(localContext);
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 499;
                this.match(LogicalTypesParser.TRY_VARIANT_GET);
                this.state = 500;
                this.match(LogicalTypesParser.T__1);
                this.state = 501;
                this.check_expr();
                this.state = 502;
                this.match(LogicalTypesParser.T__2);
                this.state = 503;
                this.check_expr();
                this.state = 504;
                this.match(LogicalTypesParser.RETURNING);
                this.state = 505;
                this.castType();
                this.state = 506;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public castType(): CastTypeContext {
        let localContext = new CastTypeContext(this.context, this.state);
        this.enterRule(localContext, 74, LogicalTypesParser.RULE_castType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 510;
            this.primitiveType();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public case_expr(): Case_exprContext {
        let localContext = new Case_exprContext(this.context, this.state);
        this.enterRule(localContext, 76, LogicalTypesParser.RULE_case_expr);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 512;
            this.match(LogicalTypesParser.CASE);
            this.state = 514;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2147495940) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 553861185) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2274443559) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4081) !== 0)) {
                {
                this.state = 513;
                this.check_expr();
                }
            }

            this.state = 517;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 516;
                this.when_clause();
                }
                }
                this.state = 519;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 97);
            this.state = 523;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 44) {
                {
                this.state = 521;
                this.match(LogicalTypesParser.ELSE);
                this.state = 522;
                this.check_expr();
                }
            }

            this.state = 525;
            this.match(LogicalTypesParser.END);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public when_clause(): When_clauseContext {
        let localContext = new When_clauseContext(this.context, this.state);
        this.enterRule(localContext, 78, LogicalTypesParser.RULE_when_clause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 527;
            this.match(LogicalTypesParser.WHEN);
            this.state = 528;
            this.check_expr();
            this.state = 529;
            this.match(LogicalTypesParser.THEN);
            this.state = 530;
            this.check_expr();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public columnref(): ColumnrefContext {
        let localContext = new ColumnrefContext(this.context, this.state);
        this.enterRule(localContext, 80, LogicalTypesParser.RULE_columnref);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 532;
            this.colid();
            this.state = 534;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 18 || _la === 19) {
                {
                this.state = 533;
                this.indirection();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public colid(): ColidContext {
        let localContext = new ColidContext(this.context, this.state);
        this.enterRule(localContext, 82, LogicalTypesParser.RULE_colid);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 536;
            this.identifier();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public indirection(): IndirectionContext {
        let localContext = new IndirectionContext(this.context, this.state);
        this.enterRule(localContext, 84, LogicalTypesParser.RULE_indirection);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 539;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 538;
                this.indirection_el();
                }
                }
                this.state = 541;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 18 || _la === 19);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public indirection_el(): Indirection_elContext {
        let localContext = new Indirection_elContext(this.context, this.state);
        this.enterRule(localContext, 86, LogicalTypesParser.RULE_indirection_el);
        try {
            this.state = 549;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.T__17:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 543;
                this.match(LogicalTypesParser.T__17);
                this.state = 544;
                this.colid();
                }
                break;
            case LogicalTypesParser.T__18:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 545;
                this.match(LogicalTypesParser.T__18);
                this.state = 546;
                this.check_expr();
                this.state = 547;
                this.match(LogicalTypesParser.T__19);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public check_expr_list(): Check_expr_listContext {
        let localContext = new Check_expr_listContext(this.context, this.state);
        this.enterRule(localContext, 88, LogicalTypesParser.RULE_check_expr_list);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 551;
            this.check_expr();
            this.state = 556;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 552;
                this.match(LogicalTypesParser.T__2);
                this.state = 553;
                this.check_expr();
                }
                }
                this.state = 558;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumBody(): EnumBodyContext {
        let localContext = new EnumBodyContext(this.context, this.state);
        this.enterRule(localContext, 90, LogicalTypesParser.RULE_enumBody);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 559;
            this.match(LogicalTypesParser.T__1);
            this.state = 560;
            this.enumValue();
            this.state = 565;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 561;
                this.match(LogicalTypesParser.T__2);
                this.state = 562;
                this.enumValue();
                }
                }
                this.state = 567;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 568;
            this.match(LogicalTypesParser.T__3);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumValue(): EnumValueContext {
        let localContext = new EnumValueContext(this.context, this.state);
        this.enterRule(localContext, 92, LogicalTypesParser.RULE_enumValue);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 570;
            this.stringLiteral();
            this.state = 572;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36 || _la === 104) {
                {
                this.state = 571;
                this.commentClause();
                }
            }

            this.state = 575;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 574;
                this.withClause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public typeExpr(): TypeExprContext;
    public typeExpr(_p: number): TypeExprContext;
    public typeExpr(_p?: number): TypeExprContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new TypeExprContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 94;
        this.enterRecursionRule(localContext, 94, LogicalTypesParser.RULE_typeExpr, _p);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 621;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 76, this.context) ) {
            case 1:
                {
                localContext = new PrimitiveTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;

                this.state = 578;
                this.primitiveType();
                this.state = 580;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 67, this.context) ) {
                case 1:
                    {
                    this.state = 579;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 2:
                {
                localContext = new VariantTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 582;
                this.variantType();
                this.state = 584;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 68, this.context) ) {
                case 1:
                    {
                    this.state = 583;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 3:
                {
                localContext = new RowTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 586;
                this.rowType();
                this.state = 588;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 69, this.context) ) {
                case 1:
                    {
                    this.state = 587;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 4:
                {
                localContext = new EnumTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 590;
                this.match(LogicalTypesParser.ENUM);
                this.state = 591;
                this.enumBody();
                this.state = 593;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 70, this.context) ) {
                case 1:
                    {
                    this.state = 592;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 5:
                {
                localContext = new UnionTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 595;
                this.unionType();
                this.state = 597;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 71, this.context) ) {
                case 1:
                    {
                    this.state = 596;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 6:
                {
                localContext = new MapTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 599;
                this.mapType();
                this.state = 601;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 72, this.context) ) {
                case 1:
                    {
                    this.state = 600;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 7:
                {
                localContext = new QualifiedNameExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 603;
                this.qualifiedName();
                this.state = 605;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 73, this.context) ) {
                case 1:
                    {
                    this.state = 604;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 8:
                {
                localContext = new PrefixArrayContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 607;
                this.match(LogicalTypesParser.ARRAY);
                this.state = 608;
                this.match(LogicalTypesParser.T__7);
                this.state = 609;
                this.typeExpr(0);
                this.state = 610;
                this.match(LogicalTypesParser.T__9);
                this.state = 612;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 74, this.context) ) {
                case 1:
                    {
                    this.state = 611;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 9:
                {
                localContext = new PrefixMultisetContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 614;
                this.match(LogicalTypesParser.MULTISET);
                this.state = 615;
                this.match(LogicalTypesParser.T__7);
                this.state = 616;
                this.typeExpr(0);
                this.state = 617;
                this.match(LogicalTypesParser.T__9);
                this.state = 619;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 75, this.context) ) {
                case 1:
                    {
                    this.state = 618;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 635;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 80, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    this.state = 633;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 79, this.context) ) {
                    case 1:
                        {
                        localContext = new PostfixArrayContext(new TypeExprContext(parentContext, parentState));
                        this.pushNewRecursionContext(localContext, _startState, LogicalTypesParser.RULE_typeExpr);
                        this.state = 623;
                        if (!(this.precpred(this.context, 3))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 3)");
                        }
                        this.state = 624;
                        this.match(LogicalTypesParser.ARRAY);
                        this.state = 626;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 77, this.context) ) {
                        case 1:
                            {
                            this.state = 625;
                            this.nullability();
                            }
                            break;
                        }
                        }
                        break;
                    case 2:
                        {
                        localContext = new PostfixMultisetContext(new TypeExprContext(parentContext, parentState));
                        this.pushNewRecursionContext(localContext, _startState, LogicalTypesParser.RULE_typeExpr);
                        this.state = 628;
                        if (!(this.precpred(this.context, 1))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 1)");
                        }
                        this.state = 629;
                        this.match(LogicalTypesParser.MULTISET);
                        this.state = 631;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 78, this.context) ) {
                        case 1:
                            {
                            this.state = 630;
                            this.nullability();
                            }
                            break;
                        }
                        }
                        break;
                    }
                    }
                }
                this.state = 637;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 80, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.unrollRecursionContexts(parentContext);
        }
        return localContext;
    }
    public primitiveType(): PrimitiveTypeContext {
        let localContext = new PrimitiveTypeContext(this.context, this.state);
        this.enterRule(localContext, 96, LogicalTypesParser.RULE_primitiveType);
        let _la: number;
        try {
            this.state = 774;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 100, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 638;
                this.match(LogicalTypesParser.BOOLEAN);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 639;
                this.match(LogicalTypesParser.TINYINT);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 640;
                this.match(LogicalTypesParser.SMALLINT);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 641;
                this.match(LogicalTypesParser.INTEGER);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 642;
                this.match(LogicalTypesParser.INT);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 643;
                this.match(LogicalTypesParser.BIGINT);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 644;
                this.match(LogicalTypesParser.FLOAT);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 645;
                this.match(LogicalTypesParser.REAL);
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 646;
                this.match(LogicalTypesParser.DOUBLE);
                this.state = 648;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 81, this.context) ) {
                case 1:
                    {
                    this.state = 647;
                    this.match(LogicalTypesParser.PRECISION);
                    }
                    break;
                }
                }
                break;
            case 10:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 650;
                this.match(LogicalTypesParser.DECIMAL);
                this.state = 659;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 83, this.context) ) {
                case 1:
                    {
                    this.state = 651;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 652;
                    this.intLiteral();
                    this.state = 655;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 3) {
                        {
                        this.state = 653;
                        this.match(LogicalTypesParser.T__2);
                        this.state = 654;
                        this.intLiteral();
                        }
                    }

                    this.state = 657;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 11:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 661;
                this.match(LogicalTypesParser.DEC);
                this.state = 670;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 85, this.context) ) {
                case 1:
                    {
                    this.state = 662;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 663;
                    this.intLiteral();
                    this.state = 666;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 3) {
                        {
                        this.state = 664;
                        this.match(LogicalTypesParser.T__2);
                        this.state = 665;
                        this.intLiteral();
                        }
                    }

                    this.state = 668;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 12:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 672;
                this.match(LogicalTypesParser.NUMERIC);
                this.state = 681;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 87, this.context) ) {
                case 1:
                    {
                    this.state = 673;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 674;
                    this.intLiteral();
                    this.state = 677;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 3) {
                        {
                        this.state = 675;
                        this.match(LogicalTypesParser.T__2);
                        this.state = 676;
                        this.intLiteral();
                        }
                    }

                    this.state = 679;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 13:
                this.enterOuterAlt(localContext, 13);
                {
                this.state = 683;
                this.match(LogicalTypesParser.CHARACTER);
                this.state = 684;
                this.match(LogicalTypesParser.VARYING);
                this.state = 689;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 88, this.context) ) {
                case 1:
                    {
                    this.state = 685;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 686;
                    this.intLiteral();
                    this.state = 687;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 14:
                this.enterOuterAlt(localContext, 14);
                {
                this.state = 691;
                this.match(LogicalTypesParser.VARCHAR);
                this.state = 696;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 89, this.context) ) {
                case 1:
                    {
                    this.state = 692;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 693;
                    this.intLiteral();
                    this.state = 694;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 15:
                this.enterOuterAlt(localContext, 15);
                {
                this.state = 698;
                this.match(LogicalTypesParser.STRING);
                }
                break;
            case 16:
                this.enterOuterAlt(localContext, 16);
                {
                this.state = 699;
                this.match(LogicalTypesParser.CHARACTER);
                this.state = 704;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 90, this.context) ) {
                case 1:
                    {
                    this.state = 700;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 701;
                    this.intLiteral();
                    this.state = 702;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 17:
                this.enterOuterAlt(localContext, 17);
                {
                this.state = 706;
                this.match(LogicalTypesParser.CHAR);
                this.state = 711;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 91, this.context) ) {
                case 1:
                    {
                    this.state = 707;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 708;
                    this.intLiteral();
                    this.state = 709;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 18:
                this.enterOuterAlt(localContext, 18);
                {
                this.state = 713;
                this.match(LogicalTypesParser.BINARY);
                this.state = 714;
                this.match(LogicalTypesParser.VARYING);
                this.state = 719;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 92, this.context) ) {
                case 1:
                    {
                    this.state = 715;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 716;
                    this.intLiteral();
                    this.state = 717;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 19:
                this.enterOuterAlt(localContext, 19);
                {
                this.state = 721;
                this.match(LogicalTypesParser.BINARY);
                this.state = 726;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 93, this.context) ) {
                case 1:
                    {
                    this.state = 722;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 723;
                    this.intLiteral();
                    this.state = 724;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 20:
                this.enterOuterAlt(localContext, 20);
                {
                this.state = 728;
                this.match(LogicalTypesParser.VARBINARY);
                this.state = 733;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 94, this.context) ) {
                case 1:
                    {
                    this.state = 729;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 730;
                    this.intLiteral();
                    this.state = 731;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 21:
                this.enterOuterAlt(localContext, 21);
                {
                this.state = 735;
                this.match(LogicalTypesParser.BYTES);
                }
                break;
            case 22:
                this.enterOuterAlt(localContext, 22);
                {
                this.state = 736;
                this.match(LogicalTypesParser.DATE);
                }
                break;
            case 23:
                this.enterOuterAlt(localContext, 23);
                {
                this.state = 737;
                this.match(LogicalTypesParser.TIME);
                this.state = 742;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 95, this.context) ) {
                case 1:
                    {
                    this.state = 738;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 739;
                    this.intLiteral();
                    this.state = 740;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 24:
                this.enterOuterAlt(localContext, 24);
                {
                this.state = 744;
                this.match(LogicalTypesParser.TIMESTAMP);
                this.state = 749;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 96, this.context) ) {
                case 1:
                    {
                    this.state = 745;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 746;
                    this.intLiteral();
                    this.state = 747;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                this.state = 754;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 97, this.context) ) {
                case 1:
                    {
                    this.state = 751;
                    this.match(LogicalTypesParser.WITHOUT);
                    this.state = 752;
                    this.match(LogicalTypesParser.TIME);
                    this.state = 753;
                    this.match(LogicalTypesParser.ZONE);
                    }
                    break;
                }
                }
                break;
            case 25:
                this.enterOuterAlt(localContext, 25);
                {
                this.state = 756;
                this.match(LogicalTypesParser.TIMESTAMP);
                this.state = 761;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 2) {
                    {
                    this.state = 757;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 758;
                    this.intLiteral();
                    this.state = 759;
                    this.match(LogicalTypesParser.T__3);
                    }
                }

                this.state = 763;
                this.match(LogicalTypesParser.WITH);
                this.state = 764;
                this.match(LogicalTypesParser.LOCAL);
                this.state = 765;
                this.match(LogicalTypesParser.TIME);
                this.state = 766;
                this.match(LogicalTypesParser.ZONE);
                }
                break;
            case 26:
                this.enterOuterAlt(localContext, 26);
                {
                this.state = 767;
                this.match(LogicalTypesParser.TIMESTAMP_LTZ);
                this.state = 772;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 99, this.context) ) {
                case 1:
                    {
                    this.state = 768;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 769;
                    this.intLiteral();
                    this.state = 770;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public variantType(): VariantTypeContext {
        let localContext = new VariantTypeContext(this.context, this.state);
        this.enterRule(localContext, 98, LogicalTypesParser.RULE_variantType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 776;
            this.match(LogicalTypesParser.VARIANT);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public rowType(): RowTypeContext {
        let localContext = new RowTypeContext(this.context, this.state);
        this.enterRule(localContext, 100, LogicalTypesParser.RULE_rowType);
        let _la: number;
        try {
            this.state = 802;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 103, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 778;
                _la = this.tokenStream.LA(1);
                if(!(_la === 74 || _la === 75)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 779;
                this.match(LogicalTypesParser.T__7);
                this.state = 780;
                this.fieldDef();
                this.state = 785;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 781;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 782;
                    this.fieldDef();
                    }
                    }
                    this.state = 787;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 788;
                this.match(LogicalTypesParser.T__9);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 790;
                _la = this.tokenStream.LA(1);
                if(!(_la === 74 || _la === 75)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 791;
                this.match(LogicalTypesParser.T__1);
                this.state = 792;
                this.fieldDef();
                this.state = 797;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 793;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 794;
                    this.fieldDef();
                    }
                    }
                    this.state = 799;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 800;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public unionType(): UnionTypeContext {
        let localContext = new UnionTypeContext(this.context, this.state);
        this.enterRule(localContext, 102, LogicalTypesParser.RULE_unionType);
        let _la: number;
        try {
            this.state = 828;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 106, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 804;
                this.match(LogicalTypesParser.UNION);
                this.state = 805;
                this.match(LogicalTypesParser.T__7);
                this.state = 806;
                this.unionBranch();
                this.state = 811;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 807;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 808;
                    this.unionBranch();
                    }
                    }
                    this.state = 813;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 814;
                this.match(LogicalTypesParser.T__9);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 816;
                this.match(LogicalTypesParser.UNION);
                this.state = 817;
                this.match(LogicalTypesParser.T__1);
                this.state = 818;
                this.unionBranch();
                this.state = 823;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 819;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 820;
                    this.unionBranch();
                    }
                    }
                    this.state = 825;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 826;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public unionBranch(): UnionBranchContext {
        let localContext = new UnionBranchContext(this.context, this.state);
        this.enterRule(localContext, 104, LogicalTypesParser.RULE_unionBranch);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 830;
            this.identifier();
            this.state = 831;
            this.typeExpr(0);
            this.state = 833;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36 || _la === 104) {
                {
                this.state = 832;
                this.commentClause();
                }
            }

            this.state = 836;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 835;
                this.withClause();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public mapType(): MapTypeContext {
        let localContext = new MapTypeContext(this.context, this.state);
        this.enterRule(localContext, 106, LogicalTypesParser.RULE_mapType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 838;
            this.match(LogicalTypesParser.MAP);
            this.state = 839;
            this.match(LogicalTypesParser.T__7);
            this.state = 840;
            this.typeExpr(0);
            this.state = 841;
            this.match(LogicalTypesParser.T__2);
            this.state = 842;
            this.typeExpr(0);
            this.state = 843;
            this.match(LogicalTypesParser.T__9);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public qualifiedName(): QualifiedNameContext {
        let localContext = new QualifiedNameContext(this.context, this.state);
        this.enterRule(localContext, 108, LogicalTypesParser.RULE_qualifiedName);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 845;
            this.identifier();
            this.state = 850;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 109, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 846;
                    this.match(LogicalTypesParser.T__17);
                    this.state = 847;
                    this.identifier();
                    }
                    }
                }
                this.state = 852;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 109, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public literal(): LiteralContext {
        let localContext = new LiteralContext(this.context, this.state);
        this.enterRule(localContext, 110, LogicalTypesParser.RULE_literal);
        try {
            this.state = 866;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 110, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 853;
                this.intLiteral();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 854;
                this.decimalLiteral();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 855;
                this.doubleLiteral();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 856;
                this.stringLiteral();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 857;
                this.bytesLiteral();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 858;
                this.boolLiteral();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 859;
                this.match(LogicalTypesParser.NULL);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 860;
                this.match(LogicalTypesParser.TIMESTAMP);
                this.state = 861;
                this.stringLiteral();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 862;
                this.match(LogicalTypesParser.INTERVAL);
                this.state = 863;
                this.stringLiteral();
                this.state = 864;
                this.identifier();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public intLiteral(): IntLiteralContext {
        let localContext = new IntLiteralContext(this.context, this.state);
        this.enterRule(localContext, 112, LogicalTypesParser.RULE_intLiteral);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 869;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13) {
                {
                this.state = 868;
                this.match(LogicalTypesParser.T__12);
                }
            }

            this.state = 871;
            this.match(LogicalTypesParser.INT_LITERAL);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public decimalLiteral(): DecimalLiteralContext {
        let localContext = new DecimalLiteralContext(this.context, this.state);
        this.enterRule(localContext, 114, LogicalTypesParser.RULE_decimalLiteral);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 874;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13) {
                {
                this.state = 873;
                this.match(LogicalTypesParser.T__12);
                }
            }

            this.state = 876;
            this.match(LogicalTypesParser.DECIMAL_LITERAL);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public doubleLiteral(): DoubleLiteralContext {
        let localContext = new DoubleLiteralContext(this.context, this.state);
        this.enterRule(localContext, 116, LogicalTypesParser.RULE_doubleLiteral);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 879;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13) {
                {
                this.state = 878;
                this.match(LogicalTypesParser.T__12);
                }
            }

            this.state = 881;
            this.match(LogicalTypesParser.DOUBLE_LITERAL);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public stringLiteral(): StringLiteralContext {
        let localContext = new StringLiteralContext(this.context, this.state);
        this.enterRule(localContext, 118, LogicalTypesParser.RULE_stringLiteral);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 883;
            this.match(LogicalTypesParser.STRING_LITERAL);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public bytesLiteral(): BytesLiteralContext {
        let localContext = new BytesLiteralContext(this.context, this.state);
        this.enterRule(localContext, 120, LogicalTypesParser.RULE_bytesLiteral);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 885;
            this.match(LogicalTypesParser.BYTES_LITERAL);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public boolLiteral(): BoolLiteralContext {
        let localContext = new BoolLiteralContext(this.context, this.state);
        this.enterRule(localContext, 122, LogicalTypesParser.RULE_boolLiteral);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 887;
            _la = this.tokenStream.LA(1);
            if(!(_la === 49 || _la === 88)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public identifier(): IdentifierContext {
        let localContext = new IdentifierContext(this.context, this.state);
        this.enterRule(localContext, 124, LogicalTypesParser.RULE_identifier);
        try {
            this.state = 892;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.ID:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 889;
                this.match(LogicalTypesParser.ID);
                }
                break;
            case LogicalTypesParser.QUOTED_ID:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 890;
                this.match(LogicalTypesParser.QUOTED_ID);
                }
                break;
            case LogicalTypesParser.ENUM:
            case LogicalTypesParser.INTERVAL:
            case LogicalTypesParser.MAP:
            case LogicalTypesParser.NAMESPACE:
            case LogicalTypesParser.REF:
            case LogicalTypesParser.TAGS:
            case LogicalTypesParser.TYPE:
            case LogicalTypesParser.VARIANT:
            case LogicalTypesParser.ZONE:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 891;
                this.nonReservedKeyword();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public nonReservedKeyword(): NonReservedKeywordContext {
        let localContext = new NonReservedKeywordContext(this.context, this.state);
        this.enterRule(localContext, 126, LogicalTypesParser.RULE_nonReservedKeyword);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 894;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 46)) & ~0x1F) === 0 && ((1 << (_la - 46)) & 67404801) !== 0) || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 1115137) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public override sempred(localContext: antlr.ParserRuleContext | null, ruleIndex: number, predIndex: number): boolean {
        switch (ruleIndex) {
        case 47:
            return this.typeExpr_sempred(localContext as TypeExprContext, predIndex);
        }
        return true;
    }
    private typeExpr_sempred(localContext: TypeExprContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 0:
            return this.precpred(this.context, 3);
        case 1:
            return this.precpred(this.context, 1);
        }
        return true;
    }

    public static readonly _serializedATN: number[] = [
        4,1,110,897,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
        7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,
        13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
        20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,
        26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,
        33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,
        39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,
        46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,
        52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,
        59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,63,1,0,1,0,1,0,3,0,
        132,8,0,1,0,1,0,1,0,5,0,137,8,0,10,0,12,0,140,9,0,1,0,1,0,1,0,5,
        0,145,8,0,10,0,12,0,148,9,0,1,0,3,0,151,8,0,3,0,153,8,0,1,0,1,0,
        3,0,157,8,0,3,0,159,8,0,1,0,1,0,1,1,1,1,1,1,1,2,1,2,1,2,1,2,1,2,
        3,2,171,8,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,1,2,3,2,182,8,2,1,3,
        1,3,1,3,1,3,3,3,188,8,3,1,3,3,3,191,8,3,1,3,3,3,194,8,3,1,3,1,3,
        1,3,1,3,3,3,200,8,3,1,3,3,3,203,8,3,3,3,205,8,3,1,4,1,4,1,4,1,5,
        1,5,1,5,1,5,5,5,214,8,5,10,5,12,5,217,9,5,1,5,1,5,1,6,1,6,3,6,223,
        8,6,1,7,1,7,1,7,3,7,228,8,7,1,7,5,7,231,8,7,10,7,12,7,234,9,7,1,
        7,3,7,237,8,7,1,7,3,7,240,8,7,1,7,3,7,243,8,7,1,8,1,8,1,9,1,9,1,
        9,3,9,250,8,9,1,10,1,10,1,10,1,11,1,11,1,11,3,11,258,8,11,1,12,1,
        12,1,12,1,12,1,12,5,12,265,8,12,10,12,12,12,268,9,12,1,12,1,12,1,
        13,1,13,1,13,1,13,1,13,5,13,277,8,13,10,13,12,13,280,9,13,1,13,1,
        13,1,14,1,14,1,14,1,14,1,15,1,15,1,16,1,16,1,17,1,17,3,17,294,8,
        17,1,17,1,17,1,17,1,17,1,17,3,17,301,8,17,1,18,1,18,1,18,1,19,1,
        19,1,20,1,20,1,20,5,20,311,8,20,10,20,12,20,314,9,20,1,21,1,21,1,
        21,5,21,319,8,21,10,21,12,21,322,9,21,1,22,1,22,1,22,3,22,327,8,
        22,1,23,1,23,1,23,3,23,332,8,23,1,23,3,23,335,8,23,1,24,1,24,1,24,
        3,24,340,8,24,1,25,1,25,3,25,344,8,25,1,25,1,25,3,25,348,8,25,1,
        25,1,25,1,25,1,25,3,25,354,8,25,1,26,1,26,3,26,358,8,26,1,26,1,26,
        3,26,362,8,26,1,27,1,27,1,27,1,27,1,27,3,27,369,8,27,1,28,1,28,3,
        28,373,8,28,1,28,1,28,1,28,3,28,378,8,28,3,28,380,8,28,1,29,1,29,
        1,29,1,30,1,30,1,30,5,30,388,8,30,10,30,12,30,391,9,30,1,31,1,31,
        1,31,5,31,396,8,31,10,31,12,31,399,9,31,1,32,3,32,402,8,32,1,32,
        1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,33,3,33,413,8,33,1,33,3,33,
        416,8,33,1,34,1,34,3,34,420,8,34,1,35,1,35,1,35,3,35,425,8,35,1,
        35,1,35,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,
        36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,3,36,450,8,36,1,
        36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,3,36,461,8,36,1,36,1,
        36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,3,36,472,8,36,1,36,1,36,1,
        36,1,36,1,36,3,36,479,8,36,1,36,1,36,1,36,3,36,484,8,36,1,36,1,36,
        1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,3,36,496,8,36,1,36,1,36,
        1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,3,36,509,8,36,1,37,
        1,37,1,38,1,38,3,38,515,8,38,1,38,4,38,518,8,38,11,38,12,38,519,
        1,38,1,38,3,38,524,8,38,1,38,1,38,1,39,1,39,1,39,1,39,1,39,1,40,
        1,40,3,40,535,8,40,1,41,1,41,1,42,4,42,540,8,42,11,42,12,42,541,
        1,43,1,43,1,43,1,43,1,43,1,43,3,43,550,8,43,1,44,1,44,1,44,5,44,
        555,8,44,10,44,12,44,558,9,44,1,45,1,45,1,45,1,45,5,45,564,8,45,
        10,45,12,45,567,9,45,1,45,1,45,1,46,1,46,3,46,573,8,46,1,46,3,46,
        576,8,46,1,47,1,47,1,47,3,47,581,8,47,1,47,1,47,3,47,585,8,47,1,
        47,1,47,3,47,589,8,47,1,47,1,47,1,47,3,47,594,8,47,1,47,1,47,3,47,
        598,8,47,1,47,1,47,3,47,602,8,47,1,47,1,47,3,47,606,8,47,1,47,1,
        47,1,47,1,47,1,47,3,47,613,8,47,1,47,1,47,1,47,1,47,1,47,3,47,620,
        8,47,3,47,622,8,47,1,47,1,47,1,47,3,47,627,8,47,1,47,1,47,1,47,3,
        47,632,8,47,5,47,634,8,47,10,47,12,47,637,9,47,1,48,1,48,1,48,1,
        48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,649,8,48,1,48,1,48,1,48,1,
        48,1,48,3,48,656,8,48,1,48,1,48,3,48,660,8,48,1,48,1,48,1,48,1,48,
        1,48,3,48,667,8,48,1,48,1,48,3,48,671,8,48,1,48,1,48,1,48,1,48,1,
        48,3,48,678,8,48,1,48,1,48,3,48,682,8,48,1,48,1,48,1,48,1,48,1,48,
        1,48,3,48,690,8,48,1,48,1,48,1,48,1,48,1,48,3,48,697,8,48,1,48,1,
        48,1,48,1,48,1,48,1,48,3,48,705,8,48,1,48,1,48,1,48,1,48,1,48,3,
        48,712,8,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,720,8,48,1,48,1,48,
        1,48,1,48,1,48,3,48,727,8,48,1,48,1,48,1,48,1,48,1,48,3,48,734,8,
        48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,743,8,48,1,48,1,48,1,
        48,1,48,1,48,3,48,750,8,48,1,48,1,48,1,48,3,48,755,8,48,1,48,1,48,
        1,48,1,48,1,48,3,48,762,8,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,
        1,48,1,48,3,48,773,8,48,3,48,775,8,48,1,49,1,49,1,50,1,50,1,50,1,
        50,1,50,5,50,784,8,50,10,50,12,50,787,9,50,1,50,1,50,1,50,1,50,1,
        50,1,50,1,50,5,50,796,8,50,10,50,12,50,799,9,50,1,50,1,50,3,50,803,
        8,50,1,51,1,51,1,51,1,51,1,51,5,51,810,8,51,10,51,12,51,813,9,51,
        1,51,1,51,1,51,1,51,1,51,1,51,1,51,5,51,822,8,51,10,51,12,51,825,
        9,51,1,51,1,51,3,51,829,8,51,1,52,1,52,1,52,3,52,834,8,52,1,52,3,
        52,837,8,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,54,1,54,1,54,5,
        54,849,8,54,10,54,12,54,852,9,54,1,55,1,55,1,55,1,55,1,55,1,55,1,
        55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,867,8,55,1,56,3,56,870,8,56,
        1,56,1,56,1,57,3,57,875,8,57,1,57,1,57,1,58,3,58,880,8,58,1,58,1,
        58,1,59,1,59,1,60,1,60,1,61,1,61,1,62,1,62,1,62,3,62,893,8,62,1,
        63,1,63,1,63,0,1,94,64,0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,
        32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,
        76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,
        114,116,118,120,122,124,126,0,7,1,0,74,75,1,0,5,11,1,0,12,13,1,0,
        14,17,3,0,29,29,58,58,86,86,2,0,49,49,88,88,9,0,46,46,56,56,61,61,
        64,64,72,72,80,80,90,90,96,96,100,100,996,0,131,1,0,0,0,2,162,1,
        0,0,0,4,181,1,0,0,0,6,204,1,0,0,0,8,206,1,0,0,0,10,209,1,0,0,0,12,
        222,1,0,0,0,14,224,1,0,0,0,16,244,1,0,0,0,18,249,1,0,0,0,20,251,
        1,0,0,0,22,257,1,0,0,0,24,259,1,0,0,0,26,271,1,0,0,0,28,283,1,0,
        0,0,30,287,1,0,0,0,32,289,1,0,0,0,34,293,1,0,0,0,36,302,1,0,0,0,
        38,305,1,0,0,0,40,307,1,0,0,0,42,315,1,0,0,0,44,326,1,0,0,0,46,328,
        1,0,0,0,48,336,1,0,0,0,50,341,1,0,0,0,52,355,1,0,0,0,54,368,1,0,
        0,0,56,370,1,0,0,0,58,381,1,0,0,0,60,384,1,0,0,0,62,392,1,0,0,0,
        64,401,1,0,0,0,66,415,1,0,0,0,68,419,1,0,0,0,70,421,1,0,0,0,72,508,
        1,0,0,0,74,510,1,0,0,0,76,512,1,0,0,0,78,527,1,0,0,0,80,532,1,0,
        0,0,82,536,1,0,0,0,84,539,1,0,0,0,86,549,1,0,0,0,88,551,1,0,0,0,
        90,559,1,0,0,0,92,570,1,0,0,0,94,621,1,0,0,0,96,774,1,0,0,0,98,776,
        1,0,0,0,100,802,1,0,0,0,102,828,1,0,0,0,104,830,1,0,0,0,106,838,
        1,0,0,0,108,845,1,0,0,0,110,866,1,0,0,0,112,869,1,0,0,0,114,874,
        1,0,0,0,116,879,1,0,0,0,118,883,1,0,0,0,120,885,1,0,0,0,122,887,
        1,0,0,0,124,892,1,0,0,0,126,894,1,0,0,0,128,129,3,2,1,0,129,130,
        5,1,0,0,130,132,1,0,0,0,131,128,1,0,0,0,131,132,1,0,0,0,132,138,
        1,0,0,0,133,134,3,4,2,0,134,135,5,1,0,0,135,137,1,0,0,0,136,133,
        1,0,0,0,137,140,1,0,0,0,138,136,1,0,0,0,138,139,1,0,0,0,139,152,
        1,0,0,0,140,138,1,0,0,0,141,146,3,6,3,0,142,143,5,1,0,0,143,145,
        3,6,3,0,144,142,1,0,0,0,145,148,1,0,0,0,146,144,1,0,0,0,146,147,
        1,0,0,0,147,150,1,0,0,0,148,146,1,0,0,0,149,151,5,1,0,0,150,149,
        1,0,0,0,150,151,1,0,0,0,151,153,1,0,0,0,152,141,1,0,0,0,152,153,
        1,0,0,0,153,158,1,0,0,0,154,156,3,8,4,0,155,157,5,1,0,0,156,155,
        1,0,0,0,156,157,1,0,0,0,157,159,1,0,0,0,158,154,1,0,0,0,158,159,
        1,0,0,0,159,160,1,0,0,0,160,161,5,0,0,1,161,1,1,0,0,0,162,163,5,
        64,0,0,163,164,3,108,54,0,164,3,1,0,0,0,165,166,5,21,0,0,166,167,
        5,90,0,0,167,168,3,108,54,0,168,170,5,51,0,0,169,171,5,90,0,0,170,
        169,1,0,0,0,170,171,1,0,0,0,171,172,1,0,0,0,172,173,3,108,54,0,173,
        182,1,0,0,0,174,175,5,21,0,0,175,176,5,90,0,0,176,177,3,108,54,0,
        177,178,5,51,0,0,178,179,5,72,0,0,179,180,3,118,59,0,180,182,1,0,
        0,0,181,165,1,0,0,0,181,174,1,0,0,0,182,5,1,0,0,0,183,184,7,0,0,
        0,184,185,3,108,54,0,185,187,3,10,5,0,186,188,3,22,11,0,187,186,
        1,0,0,0,187,188,1,0,0,0,188,190,1,0,0,0,189,191,3,24,12,0,190,189,
        1,0,0,0,190,191,1,0,0,0,191,193,1,0,0,0,192,194,3,26,13,0,193,192,
        1,0,0,0,193,194,1,0,0,0,194,205,1,0,0,0,195,196,5,46,0,0,196,197,
        3,108,54,0,197,199,3,90,45,0,198,200,3,22,11,0,199,198,1,0,0,0,199,
        200,1,0,0,0,200,202,1,0,0,0,201,203,3,26,13,0,202,201,1,0,0,0,202,
        203,1,0,0,0,203,205,1,0,0,0,204,183,1,0,0,0,204,195,1,0,0,0,205,
        7,1,0,0,0,206,207,5,90,0,0,207,208,3,94,47,0,208,9,1,0,0,0,209,210,
        5,2,0,0,210,215,3,12,6,0,211,212,5,3,0,0,212,214,3,12,6,0,213,211,
        1,0,0,0,214,217,1,0,0,0,215,213,1,0,0,0,215,216,1,0,0,0,216,218,
        1,0,0,0,217,215,1,0,0,0,218,219,5,4,0,0,219,11,1,0,0,0,220,223,3,
        14,7,0,221,223,3,32,16,0,222,220,1,0,0,0,222,221,1,0,0,0,223,13,
        1,0,0,0,224,225,3,16,8,0,225,227,3,94,47,0,226,228,3,20,10,0,227,
        226,1,0,0,0,227,228,1,0,0,0,228,232,1,0,0,0,229,231,3,30,15,0,230,
        229,1,0,0,0,231,234,1,0,0,0,232,230,1,0,0,0,232,233,1,0,0,0,233,
        236,1,0,0,0,234,232,1,0,0,0,235,237,3,22,11,0,236,235,1,0,0,0,236,
        237,1,0,0,0,237,239,1,0,0,0,238,240,3,24,12,0,239,238,1,0,0,0,239,
        240,1,0,0,0,240,242,1,0,0,0,241,243,3,26,13,0,242,241,1,0,0,0,242,
        243,1,0,0,0,243,15,1,0,0,0,244,245,3,124,62,0,245,17,1,0,0,0,246,
        250,5,66,0,0,247,248,5,65,0,0,248,250,5,66,0,0,249,246,1,0,0,0,249,
        247,1,0,0,0,250,19,1,0,0,0,251,252,5,42,0,0,252,253,3,110,55,0,253,
        21,1,0,0,0,254,255,5,36,0,0,255,258,3,118,59,0,256,258,3,118,59,
        0,257,254,1,0,0,0,257,256,1,0,0,0,258,23,1,0,0,0,259,260,5,80,0,
        0,260,261,5,2,0,0,261,266,3,118,59,0,262,263,5,3,0,0,263,265,3,118,
        59,0,264,262,1,0,0,0,265,268,1,0,0,0,266,264,1,0,0,0,266,267,1,0,
        0,0,267,269,1,0,0,0,268,266,1,0,0,0,269,270,5,4,0,0,270,25,1,0,0,
        0,271,272,5,98,0,0,272,273,5,2,0,0,273,278,3,28,14,0,274,275,5,3,
        0,0,275,277,3,28,14,0,276,274,1,0,0,0,277,280,1,0,0,0,278,276,1,
        0,0,0,278,279,1,0,0,0,279,281,1,0,0,0,280,278,1,0,0,0,281,282,5,
        4,0,0,282,27,1,0,0,0,283,284,3,118,59,0,284,285,5,5,0,0,285,286,
        3,118,59,0,286,29,1,0,0,0,287,288,3,34,17,0,288,31,1,0,0,0,289,290,
        3,34,17,0,290,33,1,0,0,0,291,292,5,37,0,0,292,294,3,124,62,0,293,
        291,1,0,0,0,293,294,1,0,0,0,294,295,1,0,0,0,295,296,5,35,0,0,296,
        297,5,2,0,0,297,298,3,38,19,0,298,300,5,4,0,0,299,301,3,36,18,0,
        300,299,1,0,0,0,300,301,1,0,0,0,301,35,1,0,0,0,302,303,5,62,0,0,
        303,304,3,118,59,0,304,37,1,0,0,0,305,306,3,40,20,0,306,39,1,0,0,
        0,307,312,3,42,21,0,308,309,5,68,0,0,309,311,3,42,21,0,310,308,1,
        0,0,0,311,314,1,0,0,0,312,310,1,0,0,0,312,313,1,0,0,0,313,41,1,0,
        0,0,314,312,1,0,0,0,315,320,3,44,22,0,316,317,5,22,0,0,317,319,3,
        44,22,0,318,316,1,0,0,0,319,322,1,0,0,0,320,318,1,0,0,0,320,321,
        1,0,0,0,321,43,1,0,0,0,322,320,1,0,0,0,323,324,5,65,0,0,324,327,
        3,44,22,0,325,327,3,46,23,0,326,323,1,0,0,0,326,325,1,0,0,0,327,
        45,1,0,0,0,328,334,3,48,24,0,329,331,5,57,0,0,330,332,5,65,0,0,331,
        330,1,0,0,0,331,332,1,0,0,0,332,333,1,0,0,0,333,335,5,66,0,0,334,
        329,1,0,0,0,334,335,1,0,0,0,335,47,1,0,0,0,336,339,3,50,25,0,337,
        338,7,1,0,0,338,340,3,50,25,0,339,337,1,0,0,0,339,340,1,0,0,0,340,
        49,1,0,0,0,341,353,3,52,26,0,342,344,5,65,0,0,343,342,1,0,0,0,343,
        344,1,0,0,0,344,345,1,0,0,0,345,347,5,25,0,0,346,348,5,79,0,0,347,
        346,1,0,0,0,347,348,1,0,0,0,348,349,1,0,0,0,349,350,3,52,26,0,350,
        351,5,22,0,0,351,352,3,52,26,0,352,354,1,0,0,0,353,343,1,0,0,0,353,
        354,1,0,0,0,354,51,1,0,0,0,355,361,3,56,28,0,356,358,5,65,0,0,357,
        356,1,0,0,0,357,358,1,0,0,0,358,359,1,0,0,0,359,360,5,53,0,0,360,
        362,3,54,27,0,361,357,1,0,0,0,361,362,1,0,0,0,362,53,1,0,0,0,363,
        364,5,2,0,0,364,365,3,88,44,0,365,366,5,4,0,0,366,369,1,0,0,0,367,
        369,3,56,28,0,368,363,1,0,0,0,368,367,1,0,0,0,369,55,1,0,0,0,370,
        379,3,60,30,0,371,373,5,65,0,0,372,371,1,0,0,0,372,373,1,0,0,0,373,
        374,1,0,0,0,374,375,5,59,0,0,375,377,3,118,59,0,376,378,3,58,29,
        0,377,376,1,0,0,0,377,378,1,0,0,0,378,380,1,0,0,0,379,372,1,0,0,
        0,379,380,1,0,0,0,380,57,1,0,0,0,381,382,5,47,0,0,382,383,3,118,
        59,0,383,59,1,0,0,0,384,389,3,62,31,0,385,386,7,2,0,0,386,388,3,
        62,31,0,387,385,1,0,0,0,388,391,1,0,0,0,389,387,1,0,0,0,389,390,
        1,0,0,0,390,61,1,0,0,0,391,389,1,0,0,0,392,397,3,64,32,0,393,394,
        7,3,0,0,394,396,3,64,32,0,395,393,1,0,0,0,396,399,1,0,0,0,397,395,
        1,0,0,0,397,398,1,0,0,0,398,63,1,0,0,0,399,397,1,0,0,0,400,402,7,
        2,0,0,401,400,1,0,0,0,401,402,1,0,0,0,402,403,1,0,0,0,403,404,3,
        66,33,0,404,65,1,0,0,0,405,416,3,68,34,0,406,416,3,80,40,0,407,416,
        3,110,55,0,408,409,5,2,0,0,409,410,3,38,19,0,410,412,5,4,0,0,411,
        413,3,84,42,0,412,411,1,0,0,0,412,413,1,0,0,0,413,416,1,0,0,0,414,
        416,3,76,38,0,415,405,1,0,0,0,415,406,1,0,0,0,415,407,1,0,0,0,415,
        408,1,0,0,0,415,414,1,0,0,0,416,67,1,0,0,0,417,420,3,72,36,0,418,
        420,3,70,35,0,419,417,1,0,0,0,419,418,1,0,0,0,420,69,1,0,0,0,421,
        422,3,124,62,0,422,424,5,2,0,0,423,425,3,88,44,0,424,423,1,0,0,0,
        424,425,1,0,0,0,425,426,1,0,0,0,426,427,5,4,0,0,427,71,1,0,0,0,428,
        429,5,32,0,0,429,430,5,2,0,0,430,431,3,38,19,0,431,432,5,24,0,0,
        432,433,3,74,37,0,433,434,5,4,0,0,434,509,1,0,0,0,435,436,5,48,0,
        0,436,437,5,2,0,0,437,438,3,124,62,0,438,439,5,52,0,0,439,440,3,
        38,19,0,440,441,5,4,0,0,441,509,1,0,0,0,442,443,5,78,0,0,443,444,
        5,2,0,0,444,445,3,38,19,0,445,446,5,52,0,0,446,449,3,38,19,0,447,
        448,5,51,0,0,448,450,3,38,19,0,449,447,1,0,0,0,449,450,1,0,0,0,450,
        451,1,0,0,0,451,452,5,4,0,0,452,509,1,0,0,0,453,454,5,78,0,0,454,
        455,5,2,0,0,455,456,3,38,19,0,456,457,5,3,0,0,457,460,3,38,19,0,
        458,459,5,3,0,0,459,461,3,38,19,0,460,458,1,0,0,0,460,461,1,0,0,
        0,461,462,1,0,0,0,462,463,5,4,0,0,463,509,1,0,0,0,464,465,5,69,0,
        0,465,466,5,2,0,0,466,467,3,66,33,0,467,468,5,53,0,0,468,471,3,38,
        19,0,469,470,5,52,0,0,470,472,3,38,19,0,471,469,1,0,0,0,471,472,
        1,0,0,0,472,473,1,0,0,0,473,474,5,4,0,0,474,509,1,0,0,0,475,476,
        5,87,0,0,476,478,5,2,0,0,477,479,7,4,0,0,478,477,1,0,0,0,478,479,
        1,0,0,0,479,480,1,0,0,0,480,483,3,38,19,0,481,482,5,52,0,0,482,484,
        3,38,19,0,483,481,1,0,0,0,483,484,1,0,0,0,484,485,1,0,0,0,485,486,
        5,4,0,0,486,509,1,0,0,0,487,509,5,38,0,0,488,489,5,95,0,0,489,490,
        5,2,0,0,490,491,3,38,19,0,491,492,5,3,0,0,492,495,3,38,19,0,493,
        494,5,73,0,0,494,496,3,74,37,0,495,493,1,0,0,0,495,496,1,0,0,0,496,
        497,1,0,0,0,497,498,5,4,0,0,498,509,1,0,0,0,499,500,5,89,0,0,500,
        501,5,2,0,0,501,502,3,38,19,0,502,503,5,3,0,0,503,504,3,38,19,0,
        504,505,5,73,0,0,505,506,3,74,37,0,506,507,5,4,0,0,507,509,1,0,0,
        0,508,428,1,0,0,0,508,435,1,0,0,0,508,442,1,0,0,0,508,453,1,0,0,
        0,508,464,1,0,0,0,508,475,1,0,0,0,508,487,1,0,0,0,508,488,1,0,0,
        0,508,499,1,0,0,0,509,73,1,0,0,0,510,511,3,96,48,0,511,75,1,0,0,
        0,512,514,5,31,0,0,513,515,3,38,19,0,514,513,1,0,0,0,514,515,1,0,
        0,0,515,517,1,0,0,0,516,518,3,78,39,0,517,516,1,0,0,0,518,519,1,
        0,0,0,519,517,1,0,0,0,519,520,1,0,0,0,520,523,1,0,0,0,521,522,5,
        44,0,0,522,524,3,38,19,0,523,521,1,0,0,0,523,524,1,0,0,0,524,525,
        1,0,0,0,525,526,5,45,0,0,526,77,1,0,0,0,527,528,5,97,0,0,528,529,
        3,38,19,0,529,530,5,81,0,0,530,531,3,38,19,0,531,79,1,0,0,0,532,
        534,3,82,41,0,533,535,3,84,42,0,534,533,1,0,0,0,534,535,1,0,0,0,
        535,81,1,0,0,0,536,537,3,124,62,0,537,83,1,0,0,0,538,540,3,86,43,
        0,539,538,1,0,0,0,540,541,1,0,0,0,541,539,1,0,0,0,541,542,1,0,0,
        0,542,85,1,0,0,0,543,544,5,18,0,0,544,550,3,82,41,0,545,546,5,19,
        0,0,546,547,3,38,19,0,547,548,5,20,0,0,548,550,1,0,0,0,549,543,1,
        0,0,0,549,545,1,0,0,0,550,87,1,0,0,0,551,556,3,38,19,0,552,553,5,
        3,0,0,553,555,3,38,19,0,554,552,1,0,0,0,555,558,1,0,0,0,556,554,
        1,0,0,0,556,557,1,0,0,0,557,89,1,0,0,0,558,556,1,0,0,0,559,560,5,
        2,0,0,560,565,3,92,46,0,561,562,5,3,0,0,562,564,3,92,46,0,563,561,
        1,0,0,0,564,567,1,0,0,0,565,563,1,0,0,0,565,566,1,0,0,0,566,568,
        1,0,0,0,567,565,1,0,0,0,568,569,5,4,0,0,569,91,1,0,0,0,570,572,3,
        118,59,0,571,573,3,22,11,0,572,571,1,0,0,0,572,573,1,0,0,0,573,575,
        1,0,0,0,574,576,3,26,13,0,575,574,1,0,0,0,575,576,1,0,0,0,576,93,
        1,0,0,0,577,578,6,47,-1,0,578,580,3,96,48,0,579,581,3,18,9,0,580,
        579,1,0,0,0,580,581,1,0,0,0,581,622,1,0,0,0,582,584,3,98,49,0,583,
        585,3,18,9,0,584,583,1,0,0,0,584,585,1,0,0,0,585,622,1,0,0,0,586,
        588,3,100,50,0,587,589,3,18,9,0,588,587,1,0,0,0,588,589,1,0,0,0,
        589,622,1,0,0,0,590,591,5,46,0,0,591,593,3,90,45,0,592,594,3,18,
        9,0,593,592,1,0,0,0,593,594,1,0,0,0,594,622,1,0,0,0,595,597,3,102,
        51,0,596,598,3,18,9,0,597,596,1,0,0,0,597,598,1,0,0,0,598,622,1,
        0,0,0,599,601,3,106,53,0,600,602,3,18,9,0,601,600,1,0,0,0,601,602,
        1,0,0,0,602,622,1,0,0,0,603,605,3,108,54,0,604,606,3,18,9,0,605,
        604,1,0,0,0,605,606,1,0,0,0,606,622,1,0,0,0,607,608,5,23,0,0,608,
        609,5,8,0,0,609,610,3,94,47,0,610,612,5,10,0,0,611,613,3,18,9,0,
        612,611,1,0,0,0,612,613,1,0,0,0,613,622,1,0,0,0,614,615,5,63,0,0,
        615,616,5,8,0,0,616,617,3,94,47,0,617,619,5,10,0,0,618,620,3,18,
        9,0,619,618,1,0,0,0,619,620,1,0,0,0,620,622,1,0,0,0,621,577,1,0,
        0,0,621,582,1,0,0,0,621,586,1,0,0,0,621,590,1,0,0,0,621,595,1,0,
        0,0,621,599,1,0,0,0,621,603,1,0,0,0,621,607,1,0,0,0,621,614,1,0,
        0,0,622,635,1,0,0,0,623,624,10,3,0,0,624,626,5,23,0,0,625,627,3,
        18,9,0,626,625,1,0,0,0,626,627,1,0,0,0,627,634,1,0,0,0,628,629,10,
        1,0,0,629,631,5,63,0,0,630,632,3,18,9,0,631,630,1,0,0,0,631,632,
        1,0,0,0,632,634,1,0,0,0,633,623,1,0,0,0,633,628,1,0,0,0,634,637,
        1,0,0,0,635,633,1,0,0,0,635,636,1,0,0,0,636,95,1,0,0,0,637,635,1,
        0,0,0,638,775,5,28,0,0,639,775,5,85,0,0,640,775,5,76,0,0,641,775,
        5,55,0,0,642,775,5,54,0,0,643,775,5,26,0,0,644,775,5,50,0,0,645,
        775,5,71,0,0,646,648,5,43,0,0,647,649,5,70,0,0,648,647,1,0,0,0,648,
        649,1,0,0,0,649,775,1,0,0,0,650,659,5,41,0,0,651,652,5,2,0,0,652,
        655,3,112,56,0,653,654,5,3,0,0,654,656,3,112,56,0,655,653,1,0,0,
        0,655,656,1,0,0,0,656,657,1,0,0,0,657,658,5,4,0,0,658,660,1,0,0,
        0,659,651,1,0,0,0,659,660,1,0,0,0,660,775,1,0,0,0,661,670,5,40,0,
        0,662,663,5,2,0,0,663,666,3,112,56,0,664,665,5,3,0,0,665,667,3,112,
        56,0,666,664,1,0,0,0,666,667,1,0,0,0,667,668,1,0,0,0,668,669,5,4,
        0,0,669,671,1,0,0,0,670,662,1,0,0,0,670,671,1,0,0,0,671,775,1,0,
        0,0,672,681,5,67,0,0,673,674,5,2,0,0,674,677,3,112,56,0,675,676,
        5,3,0,0,676,678,3,112,56,0,677,675,1,0,0,0,677,678,1,0,0,0,678,679,
        1,0,0,0,679,680,5,4,0,0,680,682,1,0,0,0,681,673,1,0,0,0,681,682,
        1,0,0,0,682,775,1,0,0,0,683,684,5,33,0,0,684,689,5,94,0,0,685,686,
        5,2,0,0,686,687,3,112,56,0,687,688,5,4,0,0,688,690,1,0,0,0,689,685,
        1,0,0,0,689,690,1,0,0,0,690,775,1,0,0,0,691,696,5,93,0,0,692,693,
        5,2,0,0,693,694,3,112,56,0,694,695,5,4,0,0,695,697,1,0,0,0,696,692,
        1,0,0,0,696,697,1,0,0,0,697,775,1,0,0,0,698,775,5,77,0,0,699,704,
        5,33,0,0,700,701,5,2,0,0,701,702,3,112,56,0,702,703,5,4,0,0,703,
        705,1,0,0,0,704,700,1,0,0,0,704,705,1,0,0,0,705,775,1,0,0,0,706,
        711,5,34,0,0,707,708,5,2,0,0,708,709,3,112,56,0,709,710,5,4,0,0,
        710,712,1,0,0,0,711,707,1,0,0,0,711,712,1,0,0,0,712,775,1,0,0,0,
        713,714,5,27,0,0,714,719,5,94,0,0,715,716,5,2,0,0,716,717,3,112,
        56,0,717,718,5,4,0,0,718,720,1,0,0,0,719,715,1,0,0,0,719,720,1,0,
        0,0,720,775,1,0,0,0,721,726,5,27,0,0,722,723,5,2,0,0,723,724,3,112,
        56,0,724,725,5,4,0,0,725,727,1,0,0,0,726,722,1,0,0,0,726,727,1,0,
        0,0,727,775,1,0,0,0,728,733,5,92,0,0,729,730,5,2,0,0,730,731,3,112,
        56,0,731,732,5,4,0,0,732,734,1,0,0,0,733,729,1,0,0,0,733,734,1,0,
        0,0,734,775,1,0,0,0,735,775,5,30,0,0,736,775,5,39,0,0,737,742,5,
        82,0,0,738,739,5,2,0,0,739,740,3,112,56,0,740,741,5,4,0,0,741,743,
        1,0,0,0,742,738,1,0,0,0,742,743,1,0,0,0,743,775,1,0,0,0,744,749,
        5,84,0,0,745,746,5,2,0,0,746,747,3,112,56,0,747,748,5,4,0,0,748,
        750,1,0,0,0,749,745,1,0,0,0,749,750,1,0,0,0,750,754,1,0,0,0,751,
        752,5,99,0,0,752,753,5,82,0,0,753,755,5,100,0,0,754,751,1,0,0,0,
        754,755,1,0,0,0,755,775,1,0,0,0,756,761,5,84,0,0,757,758,5,2,0,0,
        758,759,3,112,56,0,759,760,5,4,0,0,760,762,1,0,0,0,761,757,1,0,0,
        0,761,762,1,0,0,0,762,763,1,0,0,0,763,764,5,98,0,0,764,765,5,60,
        0,0,765,766,5,82,0,0,766,775,5,100,0,0,767,772,5,83,0,0,768,769,
        5,2,0,0,769,770,3,112,56,0,770,771,5,4,0,0,771,773,1,0,0,0,772,768,
        1,0,0,0,772,773,1,0,0,0,773,775,1,0,0,0,774,638,1,0,0,0,774,639,
        1,0,0,0,774,640,1,0,0,0,774,641,1,0,0,0,774,642,1,0,0,0,774,643,
        1,0,0,0,774,644,1,0,0,0,774,645,1,0,0,0,774,646,1,0,0,0,774,650,
        1,0,0,0,774,661,1,0,0,0,774,672,1,0,0,0,774,683,1,0,0,0,774,691,
        1,0,0,0,774,698,1,0,0,0,774,699,1,0,0,0,774,706,1,0,0,0,774,713,
        1,0,0,0,774,721,1,0,0,0,774,728,1,0,0,0,774,735,1,0,0,0,774,736,
        1,0,0,0,774,737,1,0,0,0,774,744,1,0,0,0,774,756,1,0,0,0,774,767,
        1,0,0,0,775,97,1,0,0,0,776,777,5,96,0,0,777,99,1,0,0,0,778,779,7,
        0,0,0,779,780,5,8,0,0,780,785,3,14,7,0,781,782,5,3,0,0,782,784,3,
        14,7,0,783,781,1,0,0,0,784,787,1,0,0,0,785,783,1,0,0,0,785,786,1,
        0,0,0,786,788,1,0,0,0,787,785,1,0,0,0,788,789,5,10,0,0,789,803,1,
        0,0,0,790,791,7,0,0,0,791,792,5,2,0,0,792,797,3,14,7,0,793,794,5,
        3,0,0,794,796,3,14,7,0,795,793,1,0,0,0,796,799,1,0,0,0,797,795,1,
        0,0,0,797,798,1,0,0,0,798,800,1,0,0,0,799,797,1,0,0,0,800,801,5,
        4,0,0,801,803,1,0,0,0,802,778,1,0,0,0,802,790,1,0,0,0,803,101,1,
        0,0,0,804,805,5,91,0,0,805,806,5,8,0,0,806,811,3,104,52,0,807,808,
        5,3,0,0,808,810,3,104,52,0,809,807,1,0,0,0,810,813,1,0,0,0,811,809,
        1,0,0,0,811,812,1,0,0,0,812,814,1,0,0,0,813,811,1,0,0,0,814,815,
        5,10,0,0,815,829,1,0,0,0,816,817,5,91,0,0,817,818,5,2,0,0,818,823,
        3,104,52,0,819,820,5,3,0,0,820,822,3,104,52,0,821,819,1,0,0,0,822,
        825,1,0,0,0,823,821,1,0,0,0,823,824,1,0,0,0,824,826,1,0,0,0,825,
        823,1,0,0,0,826,827,5,4,0,0,827,829,1,0,0,0,828,804,1,0,0,0,828,
        816,1,0,0,0,829,103,1,0,0,0,830,831,3,124,62,0,831,833,3,94,47,0,
        832,834,3,22,11,0,833,832,1,0,0,0,833,834,1,0,0,0,834,836,1,0,0,
        0,835,837,3,26,13,0,836,835,1,0,0,0,836,837,1,0,0,0,837,105,1,0,
        0,0,838,839,5,61,0,0,839,840,5,8,0,0,840,841,3,94,47,0,841,842,5,
        3,0,0,842,843,3,94,47,0,843,844,5,10,0,0,844,107,1,0,0,0,845,850,
        3,124,62,0,846,847,5,18,0,0,847,849,3,124,62,0,848,846,1,0,0,0,849,
        852,1,0,0,0,850,848,1,0,0,0,850,851,1,0,0,0,851,109,1,0,0,0,852,
        850,1,0,0,0,853,867,3,112,56,0,854,867,3,114,57,0,855,867,3,116,
        58,0,856,867,3,118,59,0,857,867,3,120,60,0,858,867,3,122,61,0,859,
        867,5,66,0,0,860,861,5,84,0,0,861,867,3,118,59,0,862,863,5,56,0,
        0,863,864,3,118,59,0,864,865,3,124,62,0,865,867,1,0,0,0,866,853,
        1,0,0,0,866,854,1,0,0,0,866,855,1,0,0,0,866,856,1,0,0,0,866,857,
        1,0,0,0,866,858,1,0,0,0,866,859,1,0,0,0,866,860,1,0,0,0,866,862,
        1,0,0,0,867,111,1,0,0,0,868,870,5,13,0,0,869,868,1,0,0,0,869,870,
        1,0,0,0,870,871,1,0,0,0,871,872,5,101,0,0,872,113,1,0,0,0,873,875,
        5,13,0,0,874,873,1,0,0,0,874,875,1,0,0,0,875,876,1,0,0,0,876,877,
        5,102,0,0,877,115,1,0,0,0,878,880,5,13,0,0,879,878,1,0,0,0,879,880,
        1,0,0,0,880,881,1,0,0,0,881,882,5,103,0,0,882,117,1,0,0,0,883,884,
        5,104,0,0,884,119,1,0,0,0,885,886,5,105,0,0,886,121,1,0,0,0,887,
        888,7,5,0,0,888,123,1,0,0,0,889,893,5,107,0,0,890,893,5,106,0,0,
        891,893,3,126,63,0,892,889,1,0,0,0,892,890,1,0,0,0,892,891,1,0,0,
        0,893,125,1,0,0,0,894,895,7,6,0,0,895,127,1,0,0,0,115,131,138,146,
        150,152,156,158,170,181,187,190,193,199,202,204,215,222,227,232,
        236,239,242,249,257,266,278,293,300,312,320,326,331,334,339,343,
        347,353,357,361,368,372,377,379,389,397,401,412,415,419,424,449,
        460,471,478,483,495,508,514,519,523,534,541,549,556,565,572,575,
        580,584,588,593,597,601,605,612,619,621,626,631,633,635,648,655,
        659,666,670,677,681,689,696,704,711,719,726,733,742,749,754,761,
        772,774,785,797,802,811,823,828,833,836,850,866,869,874,879,892
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!LogicalTypesParser.__ATN) {
            LogicalTypesParser.__ATN = new antlr.ATNDeserializer().deserialize(LogicalTypesParser._serializedATN);
        }

        return LogicalTypesParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(LogicalTypesParser.literalNames, LogicalTypesParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return LogicalTypesParser.vocabulary;
    }

    private static readonly decisionsToDFA = LogicalTypesParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class ScriptContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.EOF, 0)!;
    }
    public declareNamespaceStmt(): DeclareNamespaceStmtContext | null {
        return this.getRuleContext(0, DeclareNamespaceStmtContext);
    }
    public aliasStmt(): AliasStmtContext[];
    public aliasStmt(i: number): AliasStmtContext | null;
    public aliasStmt(i?: number): AliasStmtContext[] | AliasStmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AliasStmtContext);
        }

        return this.getRuleContext(i, AliasStmtContext);
    }
    public createTypeStmt(): CreateTypeStmtContext[];
    public createTypeStmt(i: number): CreateTypeStmtContext | null;
    public createTypeStmt(i?: number): CreateTypeStmtContext[] | CreateTypeStmtContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CreateTypeStmtContext);
        }

        return this.getRuleContext(i, CreateTypeStmtContext);
    }
    public registerTypeStmt(): RegisterTypeStmtContext | null {
        return this.getRuleContext(0, RegisterTypeStmtContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_script;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitScript) {
            return visitor.visitScript(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclareNamespaceStmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NAMESPACE(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.NAMESPACE, 0)!;
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_declareNamespaceStmt;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitDeclareNamespaceStmt) {
            return visitor.visitDeclareNamespaceStmt(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AliasStmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_aliasStmt;
    }
    public override copyFrom(ctx: AliasStmtContext): void {
        super.copyFrom(ctx);
    }
}
export class TypeAliasStmtContext extends AliasStmtContext {
    public constructor(ctx: AliasStmtContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public USING(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.USING, 0)!;
    }
    public TYPE(): antlr.TerminalNode[];
    public TYPE(i: number): antlr.TerminalNode | null;
    public TYPE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LogicalTypesParser.TYPE);
    	} else {
    		return this.getToken(LogicalTypesParser.TYPE, i);
    	}
    }
    public qualifiedName(): QualifiedNameContext[];
    public qualifiedName(i: number): QualifiedNameContext | null;
    public qualifiedName(i?: number): QualifiedNameContext[] | QualifiedNameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(QualifiedNameContext);
        }

        return this.getRuleContext(i, QualifiedNameContext);
    }
    public FOR(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.FOR, 0)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitTypeAliasStmt) {
            return visitor.visitTypeAliasStmt(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class TypeRefStmtContext extends AliasStmtContext {
    public constructor(ctx: AliasStmtContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public USING(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.USING, 0)!;
    }
    public TYPE(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.TYPE, 0)!;
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public FOR(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.FOR, 0)!;
    }
    public REF(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.REF, 0)!;
    }
    public stringLiteral(): StringLiteralContext {
        return this.getRuleContext(0, StringLiteralContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitTypeRefStmt) {
            return visitor.visitTypeRefStmt(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CreateTypeStmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public structBody(): StructBodyContext | null {
        return this.getRuleContext(0, StructBodyContext);
    }
    public STRUCT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.STRUCT, 0);
    }
    public ROW(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ROW, 0);
    }
    public commentClause(): CommentClauseContext | null {
        return this.getRuleContext(0, CommentClauseContext);
    }
    public tagsClause(): TagsClauseContext | null {
        return this.getRuleContext(0, TagsClauseContext);
    }
    public withClause(): WithClauseContext | null {
        return this.getRuleContext(0, WithClauseContext);
    }
    public ENUM(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ENUM, 0);
    }
    public enumBody(): EnumBodyContext | null {
        return this.getRuleContext(0, EnumBodyContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_createTypeStmt;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCreateTypeStmt) {
            return visitor.visitCreateTypeStmt(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RegisterTypeStmtContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public TYPE(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.TYPE, 0)!;
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_registerTypeStmt;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitRegisterTypeStmt) {
            return visitor.visitRegisterTypeStmt(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructBodyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public structBodyItem(): StructBodyItemContext[];
    public structBodyItem(i: number): StructBodyItemContext | null;
    public structBodyItem(i?: number): StructBodyItemContext[] | StructBodyItemContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StructBodyItemContext);
        }

        return this.getRuleContext(i, StructBodyItemContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_structBody;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitStructBody) {
            return visitor.visitStructBody(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructBodyItemContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fieldDef(): FieldDefContext | null {
        return this.getRuleContext(0, FieldDefContext);
    }
    public tableConstraint(): TableConstraintContext | null {
        return this.getRuleContext(0, TableConstraintContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_structBodyItem;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitStructBodyItem) {
            return visitor.visitStructBodyItem(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FieldDefContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fieldName(): FieldNameContext {
        return this.getRuleContext(0, FieldNameContext)!;
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public defaultClause(): DefaultClauseContext | null {
        return this.getRuleContext(0, DefaultClauseContext);
    }
    public columnConstraint(): ColumnConstraintContext[];
    public columnConstraint(i: number): ColumnConstraintContext | null;
    public columnConstraint(i?: number): ColumnConstraintContext[] | ColumnConstraintContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ColumnConstraintContext);
        }

        return this.getRuleContext(i, ColumnConstraintContext);
    }
    public commentClause(): CommentClauseContext | null {
        return this.getRuleContext(0, CommentClauseContext);
    }
    public tagsClause(): TagsClauseContext | null {
        return this.getRuleContext(0, TagsClauseContext);
    }
    public withClause(): WithClauseContext | null {
        return this.getRuleContext(0, WithClauseContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_fieldDef;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFieldDef) {
            return visitor.visitFieldDef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FieldNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_fieldName;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFieldName) {
            return visitor.visitFieldName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NullabilityContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public NULL(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.NULL, 0)!;
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NOT, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_nullability;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitNullability) {
            return visitor.visitNullability(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DefaultClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DEFAULT(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.DEFAULT, 0)!;
    }
    public literal(): LiteralContext {
        return this.getRuleContext(0, LiteralContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_defaultClause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitDefaultClause) {
            return visitor.visitDefaultClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CommentClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public COMMENT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.COMMENT, 0);
    }
    public stringLiteral(): StringLiteralContext {
        return this.getRuleContext(0, StringLiteralContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_commentClause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCommentClause) {
            return visitor.visitCommentClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TagsClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public TAGS(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.TAGS, 0)!;
    }
    public stringLiteral(): StringLiteralContext[];
    public stringLiteral(i: number): StringLiteralContext | null;
    public stringLiteral(i?: number): StringLiteralContext[] | StringLiteralContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StringLiteralContext);
        }

        return this.getRuleContext(i, StringLiteralContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_tagsClause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitTagsClause) {
            return visitor.visitTagsClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class WithClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public WITH(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.WITH, 0)!;
    }
    public withProperty(): WithPropertyContext[];
    public withProperty(i: number): WithPropertyContext | null;
    public withProperty(i?: number): WithPropertyContext[] | WithPropertyContext | null {
        if (i === undefined) {
            return this.getRuleContexts(WithPropertyContext);
        }

        return this.getRuleContext(i, WithPropertyContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_withClause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitWithClause) {
            return visitor.visitWithClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class WithPropertyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public stringLiteral(): StringLiteralContext[];
    public stringLiteral(i: number): StringLiteralContext | null;
    public stringLiteral(i?: number): StringLiteralContext[] | StringLiteralContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StringLiteralContext);
        }

        return this.getRuleContext(i, StringLiteralContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_withProperty;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitWithProperty) {
            return visitor.visitWithProperty(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ColumnConstraintContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public checkClause(): CheckClauseContext {
        return this.getRuleContext(0, CheckClauseContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_columnConstraint;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitColumnConstraint) {
            return visitor.visitColumnConstraint(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TableConstraintContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public checkClause(): CheckClauseContext {
        return this.getRuleContext(0, CheckClauseContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_tableConstraint;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitTableConstraint) {
            return visitor.visitTableConstraint(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CheckClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CHECK(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.CHECK, 0)!;
    }
    public check_expr(): Check_exprContext {
        return this.getRuleContext(0, Check_exprContext)!;
    }
    public CONSTRAINT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.CONSTRAINT, 0);
    }
    public identifier(): IdentifierContext | null {
        return this.getRuleContext(0, IdentifierContext);
    }
    public messageClause(): MessageClauseContext | null {
        return this.getRuleContext(0, MessageClauseContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_checkClause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckClause) {
            return visitor.visitCheckClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MessageClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MESSAGE(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.MESSAGE, 0)!;
    }
    public stringLiteral(): StringLiteralContext {
        return this.getRuleContext(0, StringLiteralContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_messageClause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitMessageClause) {
            return visitor.visitMessageClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_or(): Check_expr_orContext {
        return this.getRuleContext(0, Check_expr_orContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr) {
            return visitor.visitCheck_expr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_orContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_and(): Check_expr_andContext[];
    public check_expr_and(i: number): Check_expr_andContext | null;
    public check_expr_and(i?: number): Check_expr_andContext[] | Check_expr_andContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_expr_andContext);
        }

        return this.getRuleContext(i, Check_expr_andContext);
    }
    public OR(): antlr.TerminalNode[];
    public OR(i: number): antlr.TerminalNode | null;
    public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LogicalTypesParser.OR);
    	} else {
    		return this.getToken(LogicalTypesParser.OR, i);
    	}
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_or;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_or) {
            return visitor.visitCheck_expr_or(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_andContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_unary_not(): Check_expr_unary_notContext[];
    public check_expr_unary_not(i: number): Check_expr_unary_notContext | null;
    public check_expr_unary_not(i?: number): Check_expr_unary_notContext[] | Check_expr_unary_notContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_expr_unary_notContext);
        }

        return this.getRuleContext(i, Check_expr_unary_notContext);
    }
    public AND(): antlr.TerminalNode[];
    public AND(i: number): antlr.TerminalNode | null;
    public AND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(LogicalTypesParser.AND);
    	} else {
    		return this.getToken(LogicalTypesParser.AND, i);
    	}
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_and;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_and) {
            return visitor.visitCheck_expr_and(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_unary_notContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_unary_not;
    }
    public override copyFrom(ctx: Check_expr_unary_notContext): void {
        super.copyFrom(ctx);
    }
}
export class CheckExprNotContext extends Check_expr_unary_notContext {
    public constructor(ctx: Check_expr_unary_notContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public NOT(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.NOT, 0)!;
    }
    public check_expr_unary_not(): Check_expr_unary_notContext {
        return this.getRuleContext(0, Check_expr_unary_notContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckExprNot) {
            return visitor.visitCheckExprNot(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class CheckExprNotPassContext extends Check_expr_unary_notContext {
    public constructor(ctx: Check_expr_unary_notContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public check_expr_isnull(): Check_expr_isnullContext {
        return this.getRuleContext(0, Check_expr_isnullContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckExprNotPass) {
            return visitor.visitCheckExprNotPass(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_isnullContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_compare(): Check_expr_compareContext {
        return this.getRuleContext(0, Check_expr_compareContext)!;
    }
    public IS(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.IS, 0);
    }
    public NULL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NULL, 0);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NOT, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_isnull;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_isnull) {
            return visitor.visitCheck_expr_isnull(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_compareContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_between(): Check_expr_betweenContext[];
    public check_expr_between(i: number): Check_expr_betweenContext | null;
    public check_expr_between(i?: number): Check_expr_betweenContext[] | Check_expr_betweenContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_expr_betweenContext);
        }

        return this.getRuleContext(i, Check_expr_betweenContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_compare;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_compare) {
            return visitor.visitCheck_expr_compare(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_betweenContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_in(): Check_expr_inContext[];
    public check_expr_in(i: number): Check_expr_inContext | null;
    public check_expr_in(i?: number): Check_expr_inContext[] | Check_expr_inContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_expr_inContext);
        }

        return this.getRuleContext(i, Check_expr_inContext);
    }
    public BETWEEN(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.BETWEEN, 0);
    }
    public AND(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.AND, 0);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NOT, 0);
    }
    public SYMMETRIC(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.SYMMETRIC, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_between;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_between) {
            return visitor.visitCheck_expr_between(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_inContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_like(): Check_expr_likeContext {
        return this.getRuleContext(0, Check_expr_likeContext)!;
    }
    public IN(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.IN, 0);
    }
    public in_target(): In_targetContext | null {
        return this.getRuleContext(0, In_targetContext);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NOT, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_in;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_in) {
            return visitor.visitCheck_expr_in(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class In_targetContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_in_target;
    }
    public override copyFrom(ctx: In_targetContext): void {
        super.copyFrom(ctx);
    }
}
export class InTargetParenListContext extends In_targetContext {
    public constructor(ctx: In_targetContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public check_expr_list(): Check_expr_listContext {
        return this.getRuleContext(0, Check_expr_listContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitInTargetParenList) {
            return visitor.visitInTargetParenList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class InTargetExprContext extends In_targetContext {
    public constructor(ctx: In_targetContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public check_expr_like(): Check_expr_likeContext {
        return this.getRuleContext(0, Check_expr_likeContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitInTargetExpr) {
            return visitor.visitInTargetExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_likeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_add(): Check_expr_addContext {
        return this.getRuleContext(0, Check_expr_addContext)!;
    }
    public LIKE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.LIKE, 0);
    }
    public stringLiteral(): StringLiteralContext | null {
        return this.getRuleContext(0, StringLiteralContext);
    }
    public NOT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NOT, 0);
    }
    public escape_clause(): Escape_clauseContext | null {
        return this.getRuleContext(0, Escape_clauseContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_like;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_like) {
            return visitor.visitCheck_expr_like(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Escape_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ESCAPE(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.ESCAPE, 0)!;
    }
    public stringLiteral(): StringLiteralContext {
        return this.getRuleContext(0, StringLiteralContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_escape_clause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitEscape_clause) {
            return visitor.visitEscape_clause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_addContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_mul(): Check_expr_mulContext[];
    public check_expr_mul(i: number): Check_expr_mulContext | null;
    public check_expr_mul(i?: number): Check_expr_mulContext[] | Check_expr_mulContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_expr_mulContext);
        }

        return this.getRuleContext(i, Check_expr_mulContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_add;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_add) {
            return visitor.visitCheck_expr_add(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_mulContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr_unary_sign(): Check_expr_unary_signContext[];
    public check_expr_unary_sign(i: number): Check_expr_unary_signContext | null;
    public check_expr_unary_sign(i?: number): Check_expr_unary_signContext[] | Check_expr_unary_signContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_expr_unary_signContext);
        }

        return this.getRuleContext(i, Check_expr_unary_signContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_mul;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_mul) {
            return visitor.visitCheck_expr_mul(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_unary_signContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public c_expr(): C_exprContext {
        return this.getRuleContext(0, C_exprContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_unary_sign;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_unary_sign) {
            return visitor.visitCheck_expr_unary_sign(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class C_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_c_expr;
    }
    public override copyFrom(ctx: C_exprContext): void {
        super.copyFrom(ctx);
    }
}
export class CheckFuncContext extends C_exprContext {
    public constructor(ctx: C_exprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public func_expr(): Func_exprContext {
        return this.getRuleContext(0, Func_exprContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckFunc) {
            return visitor.visitCheckFunc(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class CheckColumnRefContext extends C_exprContext {
    public constructor(ctx: C_exprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public columnref(): ColumnrefContext {
        return this.getRuleContext(0, ColumnrefContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckColumnRef) {
            return visitor.visitCheckColumnRef(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class CheckLiteralContext extends C_exprContext {
    public constructor(ctx: C_exprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public literal(): LiteralContext {
        return this.getRuleContext(0, LiteralContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckLiteral) {
            return visitor.visitCheckLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class CheckParenContext extends C_exprContext {
    public constructor(ctx: C_exprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public check_expr(): Check_exprContext {
        return this.getRuleContext(0, Check_exprContext)!;
    }
    public indirection(): IndirectionContext | null {
        return this.getRuleContext(0, IndirectionContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckParen) {
            return visitor.visitCheckParen(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class CheckCaseContext extends C_exprContext {
    public constructor(ctx: C_exprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public case_expr(): Case_exprContext {
        return this.getRuleContext(0, Case_exprContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheckCase) {
            return visitor.visitCheckCase(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Func_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public func_expr_common_subexpr(): Func_expr_common_subexprContext | null {
        return this.getRuleContext(0, Func_expr_common_subexprContext);
    }
    public func_application(): Func_applicationContext | null {
        return this.getRuleContext(0, Func_applicationContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_func_expr;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFunc_expr) {
            return visitor.visitFunc_expr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Func_applicationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public check_expr_list(): Check_expr_listContext | null {
        return this.getRuleContext(0, Check_expr_listContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_func_application;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFunc_application) {
            return visitor.visitFunc_application(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Func_expr_common_subexprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_func_expr_common_subexpr;
    }
    public override copyFrom(ctx: Func_expr_common_subexprContext): void {
        super.copyFrom(ctx);
    }
}
export class FuncCastContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public CAST(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.CAST, 0)!;
    }
    public check_expr(): Check_exprContext {
        return this.getRuleContext(0, Check_exprContext)!;
    }
    public AS(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.AS, 0)!;
    }
    public castType(): CastTypeContext {
        return this.getRuleContext(0, CastTypeContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncCast) {
            return visitor.visitFuncCast(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncExtractContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public EXTRACT(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.EXTRACT, 0)!;
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public FROM(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.FROM, 0)!;
    }
    public check_expr(): Check_exprContext {
        return this.getRuleContext(0, Check_exprContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncExtract) {
            return visitor.visitFuncExtract(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncSubstringFromForContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public SUBSTRING(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.SUBSTRING, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public FROM(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.FROM, 0)!;
    }
    public FOR(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.FOR, 0);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncSubstringFromFor) {
            return visitor.visitFuncSubstringFromFor(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncSubstringCommasContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public SUBSTRING(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.SUBSTRING, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncSubstringCommas) {
            return visitor.visitFuncSubstringCommas(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncPositionContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public POSITION(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.POSITION, 0)!;
    }
    public c_expr(): C_exprContext {
        return this.getRuleContext(0, C_exprContext)!;
    }
    public IN(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.IN, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public FROM(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.FROM, 0);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncPosition) {
            return visitor.visitFuncPosition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncTrimContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public TRIM(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.TRIM, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public FROM(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.FROM, 0);
    }
    public BOTH(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.BOTH, 0);
    }
    public LEADING(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.LEADING, 0);
    }
    public TRAILING(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TRAILING, 0);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncTrim) {
            return visitor.visitFuncTrim(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncCurrentTimestampContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public CURRENT_TIMESTAMP(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.CURRENT_TIMESTAMP, 0)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncCurrentTimestamp) {
            return visitor.visitFuncCurrentTimestamp(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncVariantGetContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public VARIANT_GET(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.VARIANT_GET, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public RETURNING(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.RETURNING, 0);
    }
    public castType(): CastTypeContext | null {
        return this.getRuleContext(0, CastTypeContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncVariantGet) {
            return visitor.visitFuncVariantGet(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class FuncTryVariantGetContext extends Func_expr_common_subexprContext {
    public constructor(ctx: Func_expr_common_subexprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public TRY_VARIANT_GET(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.TRY_VARIANT_GET, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public RETURNING(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.RETURNING, 0)!;
    }
    public castType(): CastTypeContext {
        return this.getRuleContext(0, CastTypeContext)!;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitFuncTryVariantGet) {
            return visitor.visitFuncTryVariantGet(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CastTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public primitiveType(): PrimitiveTypeContext {
        return this.getRuleContext(0, PrimitiveTypeContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_castType;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCastType) {
            return visitor.visitCastType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Case_exprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public CASE(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.CASE, 0)!;
    }
    public END(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.END, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public when_clause(): When_clauseContext[];
    public when_clause(i: number): When_clauseContext | null;
    public when_clause(i?: number): When_clauseContext[] | When_clauseContext | null {
        if (i === undefined) {
            return this.getRuleContexts(When_clauseContext);
        }

        return this.getRuleContext(i, When_clauseContext);
    }
    public ELSE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ELSE, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_case_expr;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCase_expr) {
            return visitor.visitCase_expr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class When_clauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public WHEN(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.WHEN, 0)!;
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public THEN(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.THEN, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_when_clause;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitWhen_clause) {
            return visitor.visitWhen_clause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ColumnrefContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public colid(): ColidContext {
        return this.getRuleContext(0, ColidContext)!;
    }
    public indirection(): IndirectionContext | null {
        return this.getRuleContext(0, IndirectionContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_columnref;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitColumnref) {
            return visitor.visitColumnref(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ColidContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_colid;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitColid) {
            return visitor.visitColid(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IndirectionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public indirection_el(): Indirection_elContext[];
    public indirection_el(i: number): Indirection_elContext | null;
    public indirection_el(i?: number): Indirection_elContext[] | Indirection_elContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Indirection_elContext);
        }

        return this.getRuleContext(i, Indirection_elContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_indirection;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitIndirection) {
            return visitor.visitIndirection(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Indirection_elContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public colid(): ColidContext | null {
        return this.getRuleContext(0, ColidContext);
    }
    public check_expr(): Check_exprContext | null {
        return this.getRuleContext(0, Check_exprContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_indirection_el;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitIndirection_el) {
            return visitor.visitIndirection_el(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class Check_expr_listContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_check_expr_list;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitCheck_expr_list) {
            return visitor.visitCheck_expr_list(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumBodyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumValue(): EnumValueContext[];
    public enumValue(i: number): EnumValueContext | null;
    public enumValue(i?: number): EnumValueContext[] | EnumValueContext | null {
        if (i === undefined) {
            return this.getRuleContexts(EnumValueContext);
        }

        return this.getRuleContext(i, EnumValueContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_enumBody;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitEnumBody) {
            return visitor.visitEnumBody(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumValueContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public stringLiteral(): StringLiteralContext {
        return this.getRuleContext(0, StringLiteralContext)!;
    }
    public commentClause(): CommentClauseContext | null {
        return this.getRuleContext(0, CommentClauseContext);
    }
    public withClause(): WithClauseContext | null {
        return this.getRuleContext(0, WithClauseContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_enumValue;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitEnumValue) {
            return visitor.visitEnumValue(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeExprContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_typeExpr;
    }
    public override copyFrom(ctx: TypeExprContext): void {
        super.copyFrom(ctx);
    }
}
export class PrimitiveTypeExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public primitiveType(): PrimitiveTypeContext {
        return this.getRuleContext(0, PrimitiveTypeContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitPrimitiveTypeExpr) {
            return visitor.visitPrimitiveTypeExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class VariantTypeExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public variantType(): VariantTypeContext {
        return this.getRuleContext(0, VariantTypeContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitVariantTypeExpr) {
            return visitor.visitVariantTypeExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class RowTypeExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public rowType(): RowTypeContext {
        return this.getRuleContext(0, RowTypeContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitRowTypeExpr) {
            return visitor.visitRowTypeExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class EnumTypeExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public ENUM(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.ENUM, 0)!;
    }
    public enumBody(): EnumBodyContext {
        return this.getRuleContext(0, EnumBodyContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitEnumTypeExpr) {
            return visitor.visitEnumTypeExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class UnionTypeExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public unionType(): UnionTypeContext {
        return this.getRuleContext(0, UnionTypeContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitUnionTypeExpr) {
            return visitor.visitUnionTypeExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class MapTypeExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public mapType(): MapTypeContext {
        return this.getRuleContext(0, MapTypeContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitMapTypeExpr) {
            return visitor.visitMapTypeExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class QualifiedNameExprContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public qualifiedName(): QualifiedNameContext {
        return this.getRuleContext(0, QualifiedNameContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitQualifiedNameExpr) {
            return visitor.visitQualifiedNameExpr(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class PrefixArrayContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public ARRAY(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.ARRAY, 0)!;
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitPrefixArray) {
            return visitor.visitPrefixArray(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class PrefixMultisetContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public MULTISET(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.MULTISET, 0)!;
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitPrefixMultiset) {
            return visitor.visitPrefixMultiset(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class PostfixArrayContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public ARRAY(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.ARRAY, 0)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitPostfixArray) {
            return visitor.visitPostfixArray(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
export class PostfixMultisetContext extends TypeExprContext {
    public constructor(ctx: TypeExprContext) {
        super(ctx.parent, ctx.invokingState);
        super.copyFrom(ctx);
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public MULTISET(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.MULTISET, 0)!;
    }
    public nullability(): NullabilityContext | null {
        return this.getRuleContext(0, NullabilityContext);
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitPostfixMultiset) {
            return visitor.visitPostfixMultiset(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PrimitiveTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public BOOLEAN(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.BOOLEAN, 0);
    }
    public TINYINT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TINYINT, 0);
    }
    public SMALLINT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.SMALLINT, 0);
    }
    public INTEGER(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.INTEGER, 0);
    }
    public INT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.INT, 0);
    }
    public BIGINT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.BIGINT, 0);
    }
    public FLOAT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.FLOAT, 0);
    }
    public REAL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.REAL, 0);
    }
    public DOUBLE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.DOUBLE, 0);
    }
    public PRECISION(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.PRECISION, 0);
    }
    public DECIMAL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.DECIMAL, 0);
    }
    public intLiteral(): IntLiteralContext[];
    public intLiteral(i: number): IntLiteralContext | null;
    public intLiteral(i?: number): IntLiteralContext[] | IntLiteralContext | null {
        if (i === undefined) {
            return this.getRuleContexts(IntLiteralContext);
        }

        return this.getRuleContext(i, IntLiteralContext);
    }
    public DEC(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.DEC, 0);
    }
    public NUMERIC(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NUMERIC, 0);
    }
    public CHARACTER(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.CHARACTER, 0);
    }
    public VARYING(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.VARYING, 0);
    }
    public VARCHAR(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.VARCHAR, 0);
    }
    public STRING(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.STRING, 0);
    }
    public CHAR(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.CHAR, 0);
    }
    public BINARY(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.BINARY, 0);
    }
    public VARBINARY(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.VARBINARY, 0);
    }
    public BYTES(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.BYTES, 0);
    }
    public DATE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.DATE, 0);
    }
    public TIME(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TIME, 0);
    }
    public TIMESTAMP(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TIMESTAMP, 0);
    }
    public WITHOUT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.WITHOUT, 0);
    }
    public ZONE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ZONE, 0);
    }
    public WITH(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.WITH, 0);
    }
    public LOCAL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.LOCAL, 0);
    }
    public TIMESTAMP_LTZ(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TIMESTAMP_LTZ, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_primitiveType;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitPrimitiveType) {
            return visitor.visitPrimitiveType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VariantTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public VARIANT(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.VARIANT, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_variantType;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitVariantType) {
            return visitor.visitVariantType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RowTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public fieldDef(): FieldDefContext[];
    public fieldDef(i: number): FieldDefContext | null;
    public fieldDef(i?: number): FieldDefContext[] | FieldDefContext | null {
        if (i === undefined) {
            return this.getRuleContexts(FieldDefContext);
        }

        return this.getRuleContext(i, FieldDefContext);
    }
    public STRUCT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.STRUCT, 0);
    }
    public ROW(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ROW, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_rowType;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitRowType) {
            return visitor.visitRowType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UnionTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public UNION(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.UNION, 0)!;
    }
    public unionBranch(): UnionBranchContext[];
    public unionBranch(i: number): UnionBranchContext | null;
    public unionBranch(i?: number): UnionBranchContext[] | UnionBranchContext | null {
        if (i === undefined) {
            return this.getRuleContexts(UnionBranchContext);
        }

        return this.getRuleContext(i, UnionBranchContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_unionType;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitUnionType) {
            return visitor.visitUnionType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UnionBranchContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext {
        return this.getRuleContext(0, IdentifierContext)!;
    }
    public typeExpr(): TypeExprContext {
        return this.getRuleContext(0, TypeExprContext)!;
    }
    public commentClause(): CommentClauseContext | null {
        return this.getRuleContext(0, CommentClauseContext);
    }
    public withClause(): WithClauseContext | null {
        return this.getRuleContext(0, WithClauseContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_unionBranch;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitUnionBranch) {
            return visitor.visitUnionBranch(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MapTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public MAP(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.MAP, 0)!;
    }
    public typeExpr(): TypeExprContext[];
    public typeExpr(i: number): TypeExprContext | null;
    public typeExpr(i?: number): TypeExprContext[] | TypeExprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeExprContext);
        }

        return this.getRuleContext(i, TypeExprContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_mapType;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitMapType) {
            return visitor.visitMapType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class QualifiedNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public identifier(): IdentifierContext[];
    public identifier(i: number): IdentifierContext | null;
    public identifier(i?: number): IdentifierContext[] | IdentifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(IdentifierContext);
        }

        return this.getRuleContext(i, IdentifierContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_qualifiedName;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitQualifiedName) {
            return visitor.visitQualifiedName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public intLiteral(): IntLiteralContext | null {
        return this.getRuleContext(0, IntLiteralContext);
    }
    public decimalLiteral(): DecimalLiteralContext | null {
        return this.getRuleContext(0, DecimalLiteralContext);
    }
    public doubleLiteral(): DoubleLiteralContext | null {
        return this.getRuleContext(0, DoubleLiteralContext);
    }
    public stringLiteral(): StringLiteralContext | null {
        return this.getRuleContext(0, StringLiteralContext);
    }
    public bytesLiteral(): BytesLiteralContext | null {
        return this.getRuleContext(0, BytesLiteralContext);
    }
    public boolLiteral(): BoolLiteralContext | null {
        return this.getRuleContext(0, BoolLiteralContext);
    }
    public NULL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NULL, 0);
    }
    public TIMESTAMP(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TIMESTAMP, 0);
    }
    public INTERVAL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.INTERVAL, 0);
    }
    public identifier(): IdentifierContext | null {
        return this.getRuleContext(0, IdentifierContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_literal;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitLiteral) {
            return visitor.visitLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IntLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public INT_LITERAL(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.INT_LITERAL, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_intLiteral;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitIntLiteral) {
            return visitor.visitIntLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DecimalLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DECIMAL_LITERAL(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.DECIMAL_LITERAL, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_decimalLiteral;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitDecimalLiteral) {
            return visitor.visitDecimalLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DoubleLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public DOUBLE_LITERAL(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.DOUBLE_LITERAL, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_doubleLiteral;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitDoubleLiteral) {
            return visitor.visitDoubleLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StringLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public STRING_LITERAL(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.STRING_LITERAL, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_stringLiteral;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitStringLiteral) {
            return visitor.visitStringLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BytesLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public BYTES_LITERAL(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.BYTES_LITERAL, 0)!;
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_bytesLiteral;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitBytesLiteral) {
            return visitor.visitBytesLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BoolLiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public TRUE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TRUE, 0);
    }
    public FALSE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.FALSE, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_boolLiteral;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitBoolLiteral) {
            return visitor.visitBoolLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IdentifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ID(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ID, 0);
    }
    public QUOTED_ID(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.QUOTED_ID, 0);
    }
    public nonReservedKeyword(): NonReservedKeywordContext | null {
        return this.getRuleContext(0, NonReservedKeywordContext);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_identifier;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitIdentifier) {
            return visitor.visitIdentifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NonReservedKeywordContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public ENUM(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ENUM, 0);
    }
    public INTERVAL(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.INTERVAL, 0);
    }
    public MAP(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.MAP, 0);
    }
    public NAMESPACE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.NAMESPACE, 0);
    }
    public REF(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.REF, 0);
    }
    public TAGS(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TAGS, 0);
    }
    public TYPE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.TYPE, 0);
    }
    public VARIANT(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.VARIANT, 0);
    }
    public ZONE(): antlr.TerminalNode | null {
        return this.getToken(LogicalTypesParser.ZONE, 0);
    }
    public override get ruleIndex(): number {
        return LogicalTypesParser.RULE_nonReservedKeyword;
    }
    public override accept<Result>(visitor: LogicalTypesVisitor<Result>): Result | null {
        if (visitor.visitNonReservedKeyword) {
            return visitor.visitNonReservedKeyword(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
