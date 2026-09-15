
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
            this.state = 504;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 55, this.context) ) {
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
                this.check_expr();
                this.state = 467;
                this.match(LogicalTypesParser.IN);
                this.state = 468;
                this.check_expr();
                this.state = 469;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 6:
                localContext = new FuncTrimContext(localContext);
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 471;
                this.match(LogicalTypesParser.TRIM);
                this.state = 472;
                this.match(LogicalTypesParser.T__1);
                this.state = 474;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 29 || _la === 58 || _la === 86) {
                    {
                    this.state = 473;
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

                this.state = 476;
                this.check_expr();
                this.state = 479;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 52) {
                    {
                    this.state = 477;
                    this.match(LogicalTypesParser.FROM);
                    this.state = 478;
                    this.check_expr();
                    }
                }

                this.state = 481;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 7:
                localContext = new FuncCurrentTimestampContext(localContext);
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 483;
                this.match(LogicalTypesParser.CURRENT_TIMESTAMP);
                }
                break;
            case 8:
                localContext = new FuncVariantGetContext(localContext);
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 484;
                this.match(LogicalTypesParser.VARIANT_GET);
                this.state = 485;
                this.match(LogicalTypesParser.T__1);
                this.state = 486;
                this.check_expr();
                this.state = 487;
                this.match(LogicalTypesParser.T__2);
                this.state = 488;
                this.check_expr();
                this.state = 491;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 73) {
                    {
                    this.state = 489;
                    this.match(LogicalTypesParser.RETURNING);
                    this.state = 490;
                    this.castType();
                    }
                }

                this.state = 493;
                this.match(LogicalTypesParser.T__3);
                }
                break;
            case 9:
                localContext = new FuncTryVariantGetContext(localContext);
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 495;
                this.match(LogicalTypesParser.TRY_VARIANT_GET);
                this.state = 496;
                this.match(LogicalTypesParser.T__1);
                this.state = 497;
                this.check_expr();
                this.state = 498;
                this.match(LogicalTypesParser.T__2);
                this.state = 499;
                this.check_expr();
                this.state = 500;
                this.match(LogicalTypesParser.RETURNING);
                this.state = 501;
                this.castType();
                this.state = 502;
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
            this.state = 506;
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
            this.state = 508;
            this.match(LogicalTypesParser.CASE);
            this.state = 510;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 2147495940) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 553861185) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 2274443559) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4081) !== 0)) {
                {
                this.state = 509;
                this.check_expr();
                }
            }

            this.state = 513;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 512;
                this.when_clause();
                }
                }
                this.state = 515;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 97);
            this.state = 519;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 44) {
                {
                this.state = 517;
                this.match(LogicalTypesParser.ELSE);
                this.state = 518;
                this.check_expr();
                }
            }

            this.state = 521;
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
            this.state = 523;
            this.match(LogicalTypesParser.WHEN);
            this.state = 524;
            this.check_expr();
            this.state = 525;
            this.match(LogicalTypesParser.THEN);
            this.state = 526;
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
            this.state = 528;
            this.colid();
            this.state = 530;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 18 || _la === 19) {
                {
                this.state = 529;
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
            this.state = 532;
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
            this.state = 535;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 534;
                this.indirection_el();
                }
                }
                this.state = 537;
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
            this.state = 545;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.T__17:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 539;
                this.match(LogicalTypesParser.T__17);
                this.state = 540;
                this.colid();
                }
                break;
            case LogicalTypesParser.T__18:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 541;
                this.match(LogicalTypesParser.T__18);
                this.state = 542;
                this.check_expr();
                this.state = 543;
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
            this.state = 547;
            this.check_expr();
            this.state = 552;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 548;
                this.match(LogicalTypesParser.T__2);
                this.state = 549;
                this.check_expr();
                }
                }
                this.state = 554;
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
            this.state = 555;
            this.match(LogicalTypesParser.T__1);
            this.state = 556;
            this.enumValue();
            this.state = 561;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 3) {
                {
                {
                this.state = 557;
                this.match(LogicalTypesParser.T__2);
                this.state = 558;
                this.enumValue();
                }
                }
                this.state = 563;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 564;
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
            this.state = 566;
            this.stringLiteral();
            this.state = 568;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36 || _la === 104) {
                {
                this.state = 567;
                this.commentClause();
                }
            }

            this.state = 571;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 570;
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
            this.state = 612;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 74, this.context) ) {
            case 1:
                {
                localContext = new PrimitiveTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;

                this.state = 574;
                this.primitiveType();
                this.state = 576;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 66, this.context) ) {
                case 1:
                    {
                    this.state = 575;
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
                this.state = 578;
                this.variantType();
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
            case 3:
                {
                localContext = new RowTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 582;
                this.rowType();
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
            case 4:
                {
                localContext = new UnionTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 586;
                this.unionType();
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
            case 5:
                {
                localContext = new MapTypeExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 590;
                this.mapType();
                this.state = 592;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 70, this.context) ) {
                case 1:
                    {
                    this.state = 591;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 6:
                {
                localContext = new QualifiedNameExprContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 594;
                this.qualifiedName();
                this.state = 596;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 71, this.context) ) {
                case 1:
                    {
                    this.state = 595;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 7:
                {
                localContext = new PrefixArrayContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 598;
                this.match(LogicalTypesParser.ARRAY);
                this.state = 599;
                this.match(LogicalTypesParser.T__7);
                this.state = 600;
                this.typeExpr(0);
                this.state = 601;
                this.match(LogicalTypesParser.T__9);
                this.state = 603;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 72, this.context) ) {
                case 1:
                    {
                    this.state = 602;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            case 8:
                {
                localContext = new PrefixMultisetContext(localContext);
                this.context = localContext;
                previousContext = localContext;
                this.state = 605;
                this.match(LogicalTypesParser.MULTISET);
                this.state = 606;
                this.match(LogicalTypesParser.T__7);
                this.state = 607;
                this.typeExpr(0);
                this.state = 608;
                this.match(LogicalTypesParser.T__9);
                this.state = 610;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 73, this.context) ) {
                case 1:
                    {
                    this.state = 609;
                    this.nullability();
                    }
                    break;
                }
                }
                break;
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 626;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 78, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    this.state = 624;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 77, this.context) ) {
                    case 1:
                        {
                        localContext = new PostfixArrayContext(new TypeExprContext(parentContext, parentState));
                        this.pushNewRecursionContext(localContext, _startState, LogicalTypesParser.RULE_typeExpr);
                        this.state = 614;
                        if (!(this.precpred(this.context, 3))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 3)");
                        }
                        this.state = 615;
                        this.match(LogicalTypesParser.ARRAY);
                        this.state = 617;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 75, this.context) ) {
                        case 1:
                            {
                            this.state = 616;
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
                        this.state = 619;
                        if (!(this.precpred(this.context, 1))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 1)");
                        }
                        this.state = 620;
                        this.match(LogicalTypesParser.MULTISET);
                        this.state = 622;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 76, this.context) ) {
                        case 1:
                            {
                            this.state = 621;
                            this.nullability();
                            }
                            break;
                        }
                        }
                        break;
                    }
                    }
                }
                this.state = 628;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 78, this.context);
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
            this.state = 765;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 98, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 629;
                this.match(LogicalTypesParser.BOOLEAN);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 630;
                this.match(LogicalTypesParser.TINYINT);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 631;
                this.match(LogicalTypesParser.SMALLINT);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 632;
                this.match(LogicalTypesParser.INTEGER);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 633;
                this.match(LogicalTypesParser.INT);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 634;
                this.match(LogicalTypesParser.BIGINT);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 635;
                this.match(LogicalTypesParser.FLOAT);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 636;
                this.match(LogicalTypesParser.REAL);
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 637;
                this.match(LogicalTypesParser.DOUBLE);
                this.state = 639;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 79, this.context) ) {
                case 1:
                    {
                    this.state = 638;
                    this.match(LogicalTypesParser.PRECISION);
                    }
                    break;
                }
                }
                break;
            case 10:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 641;
                this.match(LogicalTypesParser.DECIMAL);
                this.state = 650;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 81, this.context) ) {
                case 1:
                    {
                    this.state = 642;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 643;
                    this.intLiteral();
                    this.state = 646;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 3) {
                        {
                        this.state = 644;
                        this.match(LogicalTypesParser.T__2);
                        this.state = 645;
                        this.intLiteral();
                        }
                    }

                    this.state = 648;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 11:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 652;
                this.match(LogicalTypesParser.DEC);
                this.state = 661;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 83, this.context) ) {
                case 1:
                    {
                    this.state = 653;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 654;
                    this.intLiteral();
                    this.state = 657;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 3) {
                        {
                        this.state = 655;
                        this.match(LogicalTypesParser.T__2);
                        this.state = 656;
                        this.intLiteral();
                        }
                    }

                    this.state = 659;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 12:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 663;
                this.match(LogicalTypesParser.NUMERIC);
                this.state = 672;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 85, this.context) ) {
                case 1:
                    {
                    this.state = 664;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 665;
                    this.intLiteral();
                    this.state = 668;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 3) {
                        {
                        this.state = 666;
                        this.match(LogicalTypesParser.T__2);
                        this.state = 667;
                        this.intLiteral();
                        }
                    }

                    this.state = 670;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 13:
                this.enterOuterAlt(localContext, 13);
                {
                this.state = 674;
                this.match(LogicalTypesParser.CHARACTER);
                this.state = 675;
                this.match(LogicalTypesParser.VARYING);
                this.state = 680;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 86, this.context) ) {
                case 1:
                    {
                    this.state = 676;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 677;
                    this.intLiteral();
                    this.state = 678;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 14:
                this.enterOuterAlt(localContext, 14);
                {
                this.state = 682;
                this.match(LogicalTypesParser.VARCHAR);
                this.state = 687;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 87, this.context) ) {
                case 1:
                    {
                    this.state = 683;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 684;
                    this.intLiteral();
                    this.state = 685;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 15:
                this.enterOuterAlt(localContext, 15);
                {
                this.state = 689;
                this.match(LogicalTypesParser.STRING);
                }
                break;
            case 16:
                this.enterOuterAlt(localContext, 16);
                {
                this.state = 690;
                this.match(LogicalTypesParser.CHARACTER);
                this.state = 695;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 88, this.context) ) {
                case 1:
                    {
                    this.state = 691;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 692;
                    this.intLiteral();
                    this.state = 693;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 17:
                this.enterOuterAlt(localContext, 17);
                {
                this.state = 697;
                this.match(LogicalTypesParser.CHAR);
                this.state = 702;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 89, this.context) ) {
                case 1:
                    {
                    this.state = 698;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 699;
                    this.intLiteral();
                    this.state = 700;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 18:
                this.enterOuterAlt(localContext, 18);
                {
                this.state = 704;
                this.match(LogicalTypesParser.BINARY);
                this.state = 705;
                this.match(LogicalTypesParser.VARYING);
                this.state = 710;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 90, this.context) ) {
                case 1:
                    {
                    this.state = 706;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 707;
                    this.intLiteral();
                    this.state = 708;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 19:
                this.enterOuterAlt(localContext, 19);
                {
                this.state = 712;
                this.match(LogicalTypesParser.BINARY);
                this.state = 717;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 91, this.context) ) {
                case 1:
                    {
                    this.state = 713;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 714;
                    this.intLiteral();
                    this.state = 715;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 20:
                this.enterOuterAlt(localContext, 20);
                {
                this.state = 719;
                this.match(LogicalTypesParser.VARBINARY);
                this.state = 724;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 92, this.context) ) {
                case 1:
                    {
                    this.state = 720;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 721;
                    this.intLiteral();
                    this.state = 722;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                }
                break;
            case 21:
                this.enterOuterAlt(localContext, 21);
                {
                this.state = 726;
                this.match(LogicalTypesParser.BYTES);
                }
                break;
            case 22:
                this.enterOuterAlt(localContext, 22);
                {
                this.state = 727;
                this.match(LogicalTypesParser.DATE);
                }
                break;
            case 23:
                this.enterOuterAlt(localContext, 23);
                {
                this.state = 728;
                this.match(LogicalTypesParser.TIME);
                this.state = 733;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 93, this.context) ) {
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
            case 24:
                this.enterOuterAlt(localContext, 24);
                {
                this.state = 735;
                this.match(LogicalTypesParser.TIMESTAMP);
                this.state = 740;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 94, this.context) ) {
                case 1:
                    {
                    this.state = 736;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 737;
                    this.intLiteral();
                    this.state = 738;
                    this.match(LogicalTypesParser.T__3);
                    }
                    break;
                }
                this.state = 745;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 95, this.context) ) {
                case 1:
                    {
                    this.state = 742;
                    this.match(LogicalTypesParser.WITHOUT);
                    this.state = 743;
                    this.match(LogicalTypesParser.TIME);
                    this.state = 744;
                    this.match(LogicalTypesParser.ZONE);
                    }
                    break;
                }
                }
                break;
            case 25:
                this.enterOuterAlt(localContext, 25);
                {
                this.state = 747;
                this.match(LogicalTypesParser.TIMESTAMP);
                this.state = 752;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 2) {
                    {
                    this.state = 748;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 749;
                    this.intLiteral();
                    this.state = 750;
                    this.match(LogicalTypesParser.T__3);
                    }
                }

                this.state = 754;
                this.match(LogicalTypesParser.WITH);
                this.state = 755;
                this.match(LogicalTypesParser.LOCAL);
                this.state = 756;
                this.match(LogicalTypesParser.TIME);
                this.state = 757;
                this.match(LogicalTypesParser.ZONE);
                }
                break;
            case 26:
                this.enterOuterAlt(localContext, 26);
                {
                this.state = 758;
                this.match(LogicalTypesParser.TIMESTAMP_LTZ);
                this.state = 763;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 97, this.context) ) {
                case 1:
                    {
                    this.state = 759;
                    this.match(LogicalTypesParser.T__1);
                    this.state = 760;
                    this.intLiteral();
                    this.state = 761;
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
            this.state = 767;
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
            this.state = 793;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 101, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 769;
                _la = this.tokenStream.LA(1);
                if(!(_la === 74 || _la === 75)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 770;
                this.match(LogicalTypesParser.T__7);
                this.state = 771;
                this.fieldDef();
                this.state = 776;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 772;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 773;
                    this.fieldDef();
                    }
                    }
                    this.state = 778;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 779;
                this.match(LogicalTypesParser.T__9);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 781;
                _la = this.tokenStream.LA(1);
                if(!(_la === 74 || _la === 75)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 782;
                this.match(LogicalTypesParser.T__1);
                this.state = 783;
                this.fieldDef();
                this.state = 788;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 784;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 785;
                    this.fieldDef();
                    }
                    }
                    this.state = 790;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 791;
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
            this.state = 819;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 104, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 795;
                this.match(LogicalTypesParser.UNION);
                this.state = 796;
                this.match(LogicalTypesParser.T__7);
                this.state = 797;
                this.unionBranch();
                this.state = 802;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 798;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 799;
                    this.unionBranch();
                    }
                    }
                    this.state = 804;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 805;
                this.match(LogicalTypesParser.T__9);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 807;
                this.match(LogicalTypesParser.UNION);
                this.state = 808;
                this.match(LogicalTypesParser.T__1);
                this.state = 809;
                this.unionBranch();
                this.state = 814;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 3) {
                    {
                    {
                    this.state = 810;
                    this.match(LogicalTypesParser.T__2);
                    this.state = 811;
                    this.unionBranch();
                    }
                    }
                    this.state = 816;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 817;
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
            this.state = 821;
            this.identifier();
            this.state = 822;
            this.typeExpr(0);
            this.state = 824;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36 || _la === 104) {
                {
                this.state = 823;
                this.commentClause();
                }
            }

            this.state = 827;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 98) {
                {
                this.state = 826;
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
            this.state = 829;
            this.match(LogicalTypesParser.MAP);
            this.state = 830;
            this.match(LogicalTypesParser.T__7);
            this.state = 831;
            this.typeExpr(0);
            this.state = 832;
            this.match(LogicalTypesParser.T__2);
            this.state = 833;
            this.typeExpr(0);
            this.state = 834;
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
            this.state = 836;
            this.identifier();
            this.state = 841;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 107, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 837;
                    this.match(LogicalTypesParser.T__17);
                    this.state = 838;
                    this.identifier();
                    }
                    }
                }
                this.state = 843;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 107, this.context);
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
            this.state = 857;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 108, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 844;
                this.intLiteral();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 845;
                this.decimalLiteral();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 846;
                this.doubleLiteral();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 847;
                this.stringLiteral();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 848;
                this.bytesLiteral();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 849;
                this.boolLiteral();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 850;
                this.match(LogicalTypesParser.NULL);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 851;
                this.match(LogicalTypesParser.TIMESTAMP);
                this.state = 852;
                this.stringLiteral();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 853;
                this.match(LogicalTypesParser.INTERVAL);
                this.state = 854;
                this.stringLiteral();
                this.state = 855;
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
            this.state = 860;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13) {
                {
                this.state = 859;
                this.match(LogicalTypesParser.T__12);
                }
            }

            this.state = 862;
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
            this.state = 865;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13) {
                {
                this.state = 864;
                this.match(LogicalTypesParser.T__12);
                }
            }

            this.state = 867;
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
            this.state = 870;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 13) {
                {
                this.state = 869;
                this.match(LogicalTypesParser.T__12);
                }
            }

            this.state = 872;
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
            this.state = 874;
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
            this.state = 876;
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
            this.state = 878;
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
            this.state = 883;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case LogicalTypesParser.ID:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 880;
                this.match(LogicalTypesParser.ID);
                }
                break;
            case LogicalTypesParser.QUOTED_ID:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 881;
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
                this.state = 882;
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
            this.state = 885;
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
        4,1,110,888,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
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
        36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,1,36,3,36,475,8,
        36,1,36,1,36,1,36,3,36,480,8,36,1,36,1,36,1,36,1,36,1,36,1,36,1,
        36,1,36,1,36,1,36,3,36,492,8,36,1,36,1,36,1,36,1,36,1,36,1,36,1,
        36,1,36,1,36,1,36,1,36,3,36,505,8,36,1,37,1,37,1,38,1,38,3,38,511,
        8,38,1,38,4,38,514,8,38,11,38,12,38,515,1,38,1,38,3,38,520,8,38,
        1,38,1,38,1,39,1,39,1,39,1,39,1,39,1,40,1,40,3,40,531,8,40,1,41,
        1,41,1,42,4,42,536,8,42,11,42,12,42,537,1,43,1,43,1,43,1,43,1,43,
        1,43,3,43,546,8,43,1,44,1,44,1,44,5,44,551,8,44,10,44,12,44,554,
        9,44,1,45,1,45,1,45,1,45,5,45,560,8,45,10,45,12,45,563,9,45,1,45,
        1,45,1,46,1,46,3,46,569,8,46,1,46,3,46,572,8,46,1,47,1,47,1,47,3,
        47,577,8,47,1,47,1,47,3,47,581,8,47,1,47,1,47,3,47,585,8,47,1,47,
        1,47,3,47,589,8,47,1,47,1,47,3,47,593,8,47,1,47,1,47,3,47,597,8,
        47,1,47,1,47,1,47,1,47,1,47,3,47,604,8,47,1,47,1,47,1,47,1,47,1,
        47,3,47,611,8,47,3,47,613,8,47,1,47,1,47,1,47,3,47,618,8,47,1,47,
        1,47,1,47,3,47,623,8,47,5,47,625,8,47,10,47,12,47,628,9,47,1,48,
        1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,640,8,48,1,48,
        1,48,1,48,1,48,1,48,3,48,647,8,48,1,48,1,48,3,48,651,8,48,1,48,1,
        48,1,48,1,48,1,48,3,48,658,8,48,1,48,1,48,3,48,662,8,48,1,48,1,48,
        1,48,1,48,1,48,3,48,669,8,48,1,48,1,48,3,48,673,8,48,1,48,1,48,1,
        48,1,48,1,48,1,48,3,48,681,8,48,1,48,1,48,1,48,1,48,1,48,3,48,688,
        8,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,696,8,48,1,48,1,48,1,48,
        1,48,1,48,3,48,703,8,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,711,8,
        48,1,48,1,48,1,48,1,48,1,48,3,48,718,8,48,1,48,1,48,1,48,1,48,1,
        48,3,48,725,8,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,734,8,48,
        1,48,1,48,1,48,1,48,1,48,3,48,741,8,48,1,48,1,48,1,48,3,48,746,8,
        48,1,48,1,48,1,48,1,48,1,48,3,48,753,8,48,1,48,1,48,1,48,1,48,1,
        48,1,48,1,48,1,48,1,48,3,48,764,8,48,3,48,766,8,48,1,49,1,49,1,50,
        1,50,1,50,1,50,1,50,5,50,775,8,50,10,50,12,50,778,9,50,1,50,1,50,
        1,50,1,50,1,50,1,50,1,50,5,50,787,8,50,10,50,12,50,790,9,50,1,50,
        1,50,3,50,794,8,50,1,51,1,51,1,51,1,51,1,51,5,51,801,8,51,10,51,
        12,51,804,9,51,1,51,1,51,1,51,1,51,1,51,1,51,1,51,5,51,813,8,51,
        10,51,12,51,816,9,51,1,51,1,51,3,51,820,8,51,1,52,1,52,1,52,3,52,
        825,8,52,1,52,3,52,828,8,52,1,53,1,53,1,53,1,53,1,53,1,53,1,53,1,
        54,1,54,1,54,5,54,840,8,54,10,54,12,54,843,9,54,1,55,1,55,1,55,1,
        55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,55,3,55,858,8,55,1,
        56,3,56,861,8,56,1,56,1,56,1,57,3,57,866,8,57,1,57,1,57,1,58,3,58,
        871,8,58,1,58,1,58,1,59,1,59,1,60,1,60,1,61,1,61,1,62,1,62,1,62,
        3,62,884,8,62,1,63,1,63,1,63,0,1,94,64,0,2,4,6,8,10,12,14,16,18,
        20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,
        64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,
        106,108,110,112,114,116,118,120,122,124,126,0,7,1,0,74,75,1,0,5,
        11,1,0,12,13,1,0,14,17,3,0,29,29,58,58,86,86,2,0,49,49,88,88,9,0,
        46,46,56,56,61,61,64,64,72,72,80,80,90,90,96,96,100,100,984,0,131,
        1,0,0,0,2,162,1,0,0,0,4,181,1,0,0,0,6,204,1,0,0,0,8,206,1,0,0,0,
        10,209,1,0,0,0,12,222,1,0,0,0,14,224,1,0,0,0,16,244,1,0,0,0,18,249,
        1,0,0,0,20,251,1,0,0,0,22,257,1,0,0,0,24,259,1,0,0,0,26,271,1,0,
        0,0,28,283,1,0,0,0,30,287,1,0,0,0,32,289,1,0,0,0,34,293,1,0,0,0,
        36,302,1,0,0,0,38,305,1,0,0,0,40,307,1,0,0,0,42,315,1,0,0,0,44,326,
        1,0,0,0,46,328,1,0,0,0,48,336,1,0,0,0,50,341,1,0,0,0,52,355,1,0,
        0,0,54,368,1,0,0,0,56,370,1,0,0,0,58,381,1,0,0,0,60,384,1,0,0,0,
        62,392,1,0,0,0,64,401,1,0,0,0,66,415,1,0,0,0,68,419,1,0,0,0,70,421,
        1,0,0,0,72,504,1,0,0,0,74,506,1,0,0,0,76,508,1,0,0,0,78,523,1,0,
        0,0,80,528,1,0,0,0,82,532,1,0,0,0,84,535,1,0,0,0,86,545,1,0,0,0,
        88,547,1,0,0,0,90,555,1,0,0,0,92,566,1,0,0,0,94,612,1,0,0,0,96,765,
        1,0,0,0,98,767,1,0,0,0,100,793,1,0,0,0,102,819,1,0,0,0,104,821,1,
        0,0,0,106,829,1,0,0,0,108,836,1,0,0,0,110,857,1,0,0,0,112,860,1,
        0,0,0,114,865,1,0,0,0,116,870,1,0,0,0,118,874,1,0,0,0,120,876,1,
        0,0,0,122,878,1,0,0,0,124,883,1,0,0,0,126,885,1,0,0,0,128,129,3,
        2,1,0,129,130,5,1,0,0,130,132,1,0,0,0,131,128,1,0,0,0,131,132,1,
        0,0,0,132,138,1,0,0,0,133,134,3,4,2,0,134,135,5,1,0,0,135,137,1,
        0,0,0,136,133,1,0,0,0,137,140,1,0,0,0,138,136,1,0,0,0,138,139,1,
        0,0,0,139,152,1,0,0,0,140,138,1,0,0,0,141,146,3,6,3,0,142,143,5,
        1,0,0,143,145,3,6,3,0,144,142,1,0,0,0,145,148,1,0,0,0,146,144,1,
        0,0,0,146,147,1,0,0,0,147,150,1,0,0,0,148,146,1,0,0,0,149,151,5,
        1,0,0,150,149,1,0,0,0,150,151,1,0,0,0,151,153,1,0,0,0,152,141,1,
        0,0,0,152,153,1,0,0,0,153,158,1,0,0,0,154,156,3,8,4,0,155,157,5,
        1,0,0,156,155,1,0,0,0,156,157,1,0,0,0,157,159,1,0,0,0,158,154,1,
        0,0,0,158,159,1,0,0,0,159,160,1,0,0,0,160,161,5,0,0,1,161,1,1,0,
        0,0,162,163,5,64,0,0,163,164,3,108,54,0,164,3,1,0,0,0,165,166,5,
        21,0,0,166,167,5,90,0,0,167,168,3,108,54,0,168,170,5,51,0,0,169,
        171,5,90,0,0,170,169,1,0,0,0,170,171,1,0,0,0,171,172,1,0,0,0,172,
        173,3,108,54,0,173,182,1,0,0,0,174,175,5,21,0,0,175,176,5,90,0,0,
        176,177,3,108,54,0,177,178,5,51,0,0,178,179,5,72,0,0,179,180,3,118,
        59,0,180,182,1,0,0,0,181,165,1,0,0,0,181,174,1,0,0,0,182,5,1,0,0,
        0,183,184,7,0,0,0,184,185,3,108,54,0,185,187,3,10,5,0,186,188,3,
        22,11,0,187,186,1,0,0,0,187,188,1,0,0,0,188,190,1,0,0,0,189,191,
        3,24,12,0,190,189,1,0,0,0,190,191,1,0,0,0,191,193,1,0,0,0,192,194,
        3,26,13,0,193,192,1,0,0,0,193,194,1,0,0,0,194,205,1,0,0,0,195,196,
        5,46,0,0,196,197,3,108,54,0,197,199,3,90,45,0,198,200,3,22,11,0,
        199,198,1,0,0,0,199,200,1,0,0,0,200,202,1,0,0,0,201,203,3,26,13,
        0,202,201,1,0,0,0,202,203,1,0,0,0,203,205,1,0,0,0,204,183,1,0,0,
        0,204,195,1,0,0,0,205,7,1,0,0,0,206,207,5,90,0,0,207,208,3,94,47,
        0,208,9,1,0,0,0,209,210,5,2,0,0,210,215,3,12,6,0,211,212,5,3,0,0,
        212,214,3,12,6,0,213,211,1,0,0,0,214,217,1,0,0,0,215,213,1,0,0,0,
        215,216,1,0,0,0,216,218,1,0,0,0,217,215,1,0,0,0,218,219,5,4,0,0,
        219,11,1,0,0,0,220,223,3,14,7,0,221,223,3,32,16,0,222,220,1,0,0,
        0,222,221,1,0,0,0,223,13,1,0,0,0,224,225,3,16,8,0,225,227,3,94,47,
        0,226,228,3,20,10,0,227,226,1,0,0,0,227,228,1,0,0,0,228,232,1,0,
        0,0,229,231,3,30,15,0,230,229,1,0,0,0,231,234,1,0,0,0,232,230,1,
        0,0,0,232,233,1,0,0,0,233,236,1,0,0,0,234,232,1,0,0,0,235,237,3,
        22,11,0,236,235,1,0,0,0,236,237,1,0,0,0,237,239,1,0,0,0,238,240,
        3,24,12,0,239,238,1,0,0,0,239,240,1,0,0,0,240,242,1,0,0,0,241,243,
        3,26,13,0,242,241,1,0,0,0,242,243,1,0,0,0,243,15,1,0,0,0,244,245,
        3,124,62,0,245,17,1,0,0,0,246,250,5,66,0,0,247,248,5,65,0,0,248,
        250,5,66,0,0,249,246,1,0,0,0,249,247,1,0,0,0,250,19,1,0,0,0,251,
        252,5,42,0,0,252,253,3,110,55,0,253,21,1,0,0,0,254,255,5,36,0,0,
        255,258,3,118,59,0,256,258,3,118,59,0,257,254,1,0,0,0,257,256,1,
        0,0,0,258,23,1,0,0,0,259,260,5,80,0,0,260,261,5,2,0,0,261,266,3,
        118,59,0,262,263,5,3,0,0,263,265,3,118,59,0,264,262,1,0,0,0,265,
        268,1,0,0,0,266,264,1,0,0,0,266,267,1,0,0,0,267,269,1,0,0,0,268,
        266,1,0,0,0,269,270,5,4,0,0,270,25,1,0,0,0,271,272,5,98,0,0,272,
        273,5,2,0,0,273,278,3,28,14,0,274,275,5,3,0,0,275,277,3,28,14,0,
        276,274,1,0,0,0,277,280,1,0,0,0,278,276,1,0,0,0,278,279,1,0,0,0,
        279,281,1,0,0,0,280,278,1,0,0,0,281,282,5,4,0,0,282,27,1,0,0,0,283,
        284,3,118,59,0,284,285,5,5,0,0,285,286,3,118,59,0,286,29,1,0,0,0,
        287,288,3,34,17,0,288,31,1,0,0,0,289,290,3,34,17,0,290,33,1,0,0,
        0,291,292,5,37,0,0,292,294,3,124,62,0,293,291,1,0,0,0,293,294,1,
        0,0,0,294,295,1,0,0,0,295,296,5,35,0,0,296,297,5,2,0,0,297,298,3,
        38,19,0,298,300,5,4,0,0,299,301,3,36,18,0,300,299,1,0,0,0,300,301,
        1,0,0,0,301,35,1,0,0,0,302,303,5,62,0,0,303,304,3,118,59,0,304,37,
        1,0,0,0,305,306,3,40,20,0,306,39,1,0,0,0,307,312,3,42,21,0,308,309,
        5,68,0,0,309,311,3,42,21,0,310,308,1,0,0,0,311,314,1,0,0,0,312,310,
        1,0,0,0,312,313,1,0,0,0,313,41,1,0,0,0,314,312,1,0,0,0,315,320,3,
        44,22,0,316,317,5,22,0,0,317,319,3,44,22,0,318,316,1,0,0,0,319,322,
        1,0,0,0,320,318,1,0,0,0,320,321,1,0,0,0,321,43,1,0,0,0,322,320,1,
        0,0,0,323,324,5,65,0,0,324,327,3,44,22,0,325,327,3,46,23,0,326,323,
        1,0,0,0,326,325,1,0,0,0,327,45,1,0,0,0,328,334,3,48,24,0,329,331,
        5,57,0,0,330,332,5,65,0,0,331,330,1,0,0,0,331,332,1,0,0,0,332,333,
        1,0,0,0,333,335,5,66,0,0,334,329,1,0,0,0,334,335,1,0,0,0,335,47,
        1,0,0,0,336,339,3,50,25,0,337,338,7,1,0,0,338,340,3,50,25,0,339,
        337,1,0,0,0,339,340,1,0,0,0,340,49,1,0,0,0,341,353,3,52,26,0,342,
        344,5,65,0,0,343,342,1,0,0,0,343,344,1,0,0,0,344,345,1,0,0,0,345,
        347,5,25,0,0,346,348,5,79,0,0,347,346,1,0,0,0,347,348,1,0,0,0,348,
        349,1,0,0,0,349,350,3,52,26,0,350,351,5,22,0,0,351,352,3,52,26,0,
        352,354,1,0,0,0,353,343,1,0,0,0,353,354,1,0,0,0,354,51,1,0,0,0,355,
        361,3,56,28,0,356,358,5,65,0,0,357,356,1,0,0,0,357,358,1,0,0,0,358,
        359,1,0,0,0,359,360,5,53,0,0,360,362,3,54,27,0,361,357,1,0,0,0,361,
        362,1,0,0,0,362,53,1,0,0,0,363,364,5,2,0,0,364,365,3,88,44,0,365,
        366,5,4,0,0,366,369,1,0,0,0,367,369,3,56,28,0,368,363,1,0,0,0,368,
        367,1,0,0,0,369,55,1,0,0,0,370,379,3,60,30,0,371,373,5,65,0,0,372,
        371,1,0,0,0,372,373,1,0,0,0,373,374,1,0,0,0,374,375,5,59,0,0,375,
        377,3,118,59,0,376,378,3,58,29,0,377,376,1,0,0,0,377,378,1,0,0,0,
        378,380,1,0,0,0,379,372,1,0,0,0,379,380,1,0,0,0,380,57,1,0,0,0,381,
        382,5,47,0,0,382,383,3,118,59,0,383,59,1,0,0,0,384,389,3,62,31,0,
        385,386,7,2,0,0,386,388,3,62,31,0,387,385,1,0,0,0,388,391,1,0,0,
        0,389,387,1,0,0,0,389,390,1,0,0,0,390,61,1,0,0,0,391,389,1,0,0,0,
        392,397,3,64,32,0,393,394,7,3,0,0,394,396,3,64,32,0,395,393,1,0,
        0,0,396,399,1,0,0,0,397,395,1,0,0,0,397,398,1,0,0,0,398,63,1,0,0,
        0,399,397,1,0,0,0,400,402,7,2,0,0,401,400,1,0,0,0,401,402,1,0,0,
        0,402,403,1,0,0,0,403,404,3,66,33,0,404,65,1,0,0,0,405,416,3,68,
        34,0,406,416,3,80,40,0,407,416,3,110,55,0,408,409,5,2,0,0,409,410,
        3,38,19,0,410,412,5,4,0,0,411,413,3,84,42,0,412,411,1,0,0,0,412,
        413,1,0,0,0,413,416,1,0,0,0,414,416,3,76,38,0,415,405,1,0,0,0,415,
        406,1,0,0,0,415,407,1,0,0,0,415,408,1,0,0,0,415,414,1,0,0,0,416,
        67,1,0,0,0,417,420,3,72,36,0,418,420,3,70,35,0,419,417,1,0,0,0,419,
        418,1,0,0,0,420,69,1,0,0,0,421,422,3,124,62,0,422,424,5,2,0,0,423,
        425,3,88,44,0,424,423,1,0,0,0,424,425,1,0,0,0,425,426,1,0,0,0,426,
        427,5,4,0,0,427,71,1,0,0,0,428,429,5,32,0,0,429,430,5,2,0,0,430,
        431,3,38,19,0,431,432,5,24,0,0,432,433,3,74,37,0,433,434,5,4,0,0,
        434,505,1,0,0,0,435,436,5,48,0,0,436,437,5,2,0,0,437,438,3,124,62,
        0,438,439,5,52,0,0,439,440,3,38,19,0,440,441,5,4,0,0,441,505,1,0,
        0,0,442,443,5,78,0,0,443,444,5,2,0,0,444,445,3,38,19,0,445,446,5,
        52,0,0,446,449,3,38,19,0,447,448,5,51,0,0,448,450,3,38,19,0,449,
        447,1,0,0,0,449,450,1,0,0,0,450,451,1,0,0,0,451,452,5,4,0,0,452,
        505,1,0,0,0,453,454,5,78,0,0,454,455,5,2,0,0,455,456,3,38,19,0,456,
        457,5,3,0,0,457,460,3,38,19,0,458,459,5,3,0,0,459,461,3,38,19,0,
        460,458,1,0,0,0,460,461,1,0,0,0,461,462,1,0,0,0,462,463,5,4,0,0,
        463,505,1,0,0,0,464,465,5,69,0,0,465,466,5,2,0,0,466,467,3,38,19,
        0,467,468,5,53,0,0,468,469,3,38,19,0,469,470,5,4,0,0,470,505,1,0,
        0,0,471,472,5,87,0,0,472,474,5,2,0,0,473,475,7,4,0,0,474,473,1,0,
        0,0,474,475,1,0,0,0,475,476,1,0,0,0,476,479,3,38,19,0,477,478,5,
        52,0,0,478,480,3,38,19,0,479,477,1,0,0,0,479,480,1,0,0,0,480,481,
        1,0,0,0,481,482,5,4,0,0,482,505,1,0,0,0,483,505,5,38,0,0,484,485,
        5,95,0,0,485,486,5,2,0,0,486,487,3,38,19,0,487,488,5,3,0,0,488,491,
        3,38,19,0,489,490,5,73,0,0,490,492,3,74,37,0,491,489,1,0,0,0,491,
        492,1,0,0,0,492,493,1,0,0,0,493,494,5,4,0,0,494,505,1,0,0,0,495,
        496,5,89,0,0,496,497,5,2,0,0,497,498,3,38,19,0,498,499,5,3,0,0,499,
        500,3,38,19,0,500,501,5,73,0,0,501,502,3,74,37,0,502,503,5,4,0,0,
        503,505,1,0,0,0,504,428,1,0,0,0,504,435,1,0,0,0,504,442,1,0,0,0,
        504,453,1,0,0,0,504,464,1,0,0,0,504,471,1,0,0,0,504,483,1,0,0,0,
        504,484,1,0,0,0,504,495,1,0,0,0,505,73,1,0,0,0,506,507,3,96,48,0,
        507,75,1,0,0,0,508,510,5,31,0,0,509,511,3,38,19,0,510,509,1,0,0,
        0,510,511,1,0,0,0,511,513,1,0,0,0,512,514,3,78,39,0,513,512,1,0,
        0,0,514,515,1,0,0,0,515,513,1,0,0,0,515,516,1,0,0,0,516,519,1,0,
        0,0,517,518,5,44,0,0,518,520,3,38,19,0,519,517,1,0,0,0,519,520,1,
        0,0,0,520,521,1,0,0,0,521,522,5,45,0,0,522,77,1,0,0,0,523,524,5,
        97,0,0,524,525,3,38,19,0,525,526,5,81,0,0,526,527,3,38,19,0,527,
        79,1,0,0,0,528,530,3,82,41,0,529,531,3,84,42,0,530,529,1,0,0,0,530,
        531,1,0,0,0,531,81,1,0,0,0,532,533,3,124,62,0,533,83,1,0,0,0,534,
        536,3,86,43,0,535,534,1,0,0,0,536,537,1,0,0,0,537,535,1,0,0,0,537,
        538,1,0,0,0,538,85,1,0,0,0,539,540,5,18,0,0,540,546,3,82,41,0,541,
        542,5,19,0,0,542,543,3,38,19,0,543,544,5,20,0,0,544,546,1,0,0,0,
        545,539,1,0,0,0,545,541,1,0,0,0,546,87,1,0,0,0,547,552,3,38,19,0,
        548,549,5,3,0,0,549,551,3,38,19,0,550,548,1,0,0,0,551,554,1,0,0,
        0,552,550,1,0,0,0,552,553,1,0,0,0,553,89,1,0,0,0,554,552,1,0,0,0,
        555,556,5,2,0,0,556,561,3,92,46,0,557,558,5,3,0,0,558,560,3,92,46,
        0,559,557,1,0,0,0,560,563,1,0,0,0,561,559,1,0,0,0,561,562,1,0,0,
        0,562,564,1,0,0,0,563,561,1,0,0,0,564,565,5,4,0,0,565,91,1,0,0,0,
        566,568,3,118,59,0,567,569,3,22,11,0,568,567,1,0,0,0,568,569,1,0,
        0,0,569,571,1,0,0,0,570,572,3,26,13,0,571,570,1,0,0,0,571,572,1,
        0,0,0,572,93,1,0,0,0,573,574,6,47,-1,0,574,576,3,96,48,0,575,577,
        3,18,9,0,576,575,1,0,0,0,576,577,1,0,0,0,577,613,1,0,0,0,578,580,
        3,98,49,0,579,581,3,18,9,0,580,579,1,0,0,0,580,581,1,0,0,0,581,613,
        1,0,0,0,582,584,3,100,50,0,583,585,3,18,9,0,584,583,1,0,0,0,584,
        585,1,0,0,0,585,613,1,0,0,0,586,588,3,102,51,0,587,589,3,18,9,0,
        588,587,1,0,0,0,588,589,1,0,0,0,589,613,1,0,0,0,590,592,3,106,53,
        0,591,593,3,18,9,0,592,591,1,0,0,0,592,593,1,0,0,0,593,613,1,0,0,
        0,594,596,3,108,54,0,595,597,3,18,9,0,596,595,1,0,0,0,596,597,1,
        0,0,0,597,613,1,0,0,0,598,599,5,23,0,0,599,600,5,8,0,0,600,601,3,
        94,47,0,601,603,5,10,0,0,602,604,3,18,9,0,603,602,1,0,0,0,603,604,
        1,0,0,0,604,613,1,0,0,0,605,606,5,63,0,0,606,607,5,8,0,0,607,608,
        3,94,47,0,608,610,5,10,0,0,609,611,3,18,9,0,610,609,1,0,0,0,610,
        611,1,0,0,0,611,613,1,0,0,0,612,573,1,0,0,0,612,578,1,0,0,0,612,
        582,1,0,0,0,612,586,1,0,0,0,612,590,1,0,0,0,612,594,1,0,0,0,612,
        598,1,0,0,0,612,605,1,0,0,0,613,626,1,0,0,0,614,615,10,3,0,0,615,
        617,5,23,0,0,616,618,3,18,9,0,617,616,1,0,0,0,617,618,1,0,0,0,618,
        625,1,0,0,0,619,620,10,1,0,0,620,622,5,63,0,0,621,623,3,18,9,0,622,
        621,1,0,0,0,622,623,1,0,0,0,623,625,1,0,0,0,624,614,1,0,0,0,624,
        619,1,0,0,0,625,628,1,0,0,0,626,624,1,0,0,0,626,627,1,0,0,0,627,
        95,1,0,0,0,628,626,1,0,0,0,629,766,5,28,0,0,630,766,5,85,0,0,631,
        766,5,76,0,0,632,766,5,55,0,0,633,766,5,54,0,0,634,766,5,26,0,0,
        635,766,5,50,0,0,636,766,5,71,0,0,637,639,5,43,0,0,638,640,5,70,
        0,0,639,638,1,0,0,0,639,640,1,0,0,0,640,766,1,0,0,0,641,650,5,41,
        0,0,642,643,5,2,0,0,643,646,3,112,56,0,644,645,5,3,0,0,645,647,3,
        112,56,0,646,644,1,0,0,0,646,647,1,0,0,0,647,648,1,0,0,0,648,649,
        5,4,0,0,649,651,1,0,0,0,650,642,1,0,0,0,650,651,1,0,0,0,651,766,
        1,0,0,0,652,661,5,40,0,0,653,654,5,2,0,0,654,657,3,112,56,0,655,
        656,5,3,0,0,656,658,3,112,56,0,657,655,1,0,0,0,657,658,1,0,0,0,658,
        659,1,0,0,0,659,660,5,4,0,0,660,662,1,0,0,0,661,653,1,0,0,0,661,
        662,1,0,0,0,662,766,1,0,0,0,663,672,5,67,0,0,664,665,5,2,0,0,665,
        668,3,112,56,0,666,667,5,3,0,0,667,669,3,112,56,0,668,666,1,0,0,
        0,668,669,1,0,0,0,669,670,1,0,0,0,670,671,5,4,0,0,671,673,1,0,0,
        0,672,664,1,0,0,0,672,673,1,0,0,0,673,766,1,0,0,0,674,675,5,33,0,
        0,675,680,5,94,0,0,676,677,5,2,0,0,677,678,3,112,56,0,678,679,5,
        4,0,0,679,681,1,0,0,0,680,676,1,0,0,0,680,681,1,0,0,0,681,766,1,
        0,0,0,682,687,5,93,0,0,683,684,5,2,0,0,684,685,3,112,56,0,685,686,
        5,4,0,0,686,688,1,0,0,0,687,683,1,0,0,0,687,688,1,0,0,0,688,766,
        1,0,0,0,689,766,5,77,0,0,690,695,5,33,0,0,691,692,5,2,0,0,692,693,
        3,112,56,0,693,694,5,4,0,0,694,696,1,0,0,0,695,691,1,0,0,0,695,696,
        1,0,0,0,696,766,1,0,0,0,697,702,5,34,0,0,698,699,5,2,0,0,699,700,
        3,112,56,0,700,701,5,4,0,0,701,703,1,0,0,0,702,698,1,0,0,0,702,703,
        1,0,0,0,703,766,1,0,0,0,704,705,5,27,0,0,705,710,5,94,0,0,706,707,
        5,2,0,0,707,708,3,112,56,0,708,709,5,4,0,0,709,711,1,0,0,0,710,706,
        1,0,0,0,710,711,1,0,0,0,711,766,1,0,0,0,712,717,5,27,0,0,713,714,
        5,2,0,0,714,715,3,112,56,0,715,716,5,4,0,0,716,718,1,0,0,0,717,713,
        1,0,0,0,717,718,1,0,0,0,718,766,1,0,0,0,719,724,5,92,0,0,720,721,
        5,2,0,0,721,722,3,112,56,0,722,723,5,4,0,0,723,725,1,0,0,0,724,720,
        1,0,0,0,724,725,1,0,0,0,725,766,1,0,0,0,726,766,5,30,0,0,727,766,
        5,39,0,0,728,733,5,82,0,0,729,730,5,2,0,0,730,731,3,112,56,0,731,
        732,5,4,0,0,732,734,1,0,0,0,733,729,1,0,0,0,733,734,1,0,0,0,734,
        766,1,0,0,0,735,740,5,84,0,0,736,737,5,2,0,0,737,738,3,112,56,0,
        738,739,5,4,0,0,739,741,1,0,0,0,740,736,1,0,0,0,740,741,1,0,0,0,
        741,745,1,0,0,0,742,743,5,99,0,0,743,744,5,82,0,0,744,746,5,100,
        0,0,745,742,1,0,0,0,745,746,1,0,0,0,746,766,1,0,0,0,747,752,5,84,
        0,0,748,749,5,2,0,0,749,750,3,112,56,0,750,751,5,4,0,0,751,753,1,
        0,0,0,752,748,1,0,0,0,752,753,1,0,0,0,753,754,1,0,0,0,754,755,5,
        98,0,0,755,756,5,60,0,0,756,757,5,82,0,0,757,766,5,100,0,0,758,763,
        5,83,0,0,759,760,5,2,0,0,760,761,3,112,56,0,761,762,5,4,0,0,762,
        764,1,0,0,0,763,759,1,0,0,0,763,764,1,0,0,0,764,766,1,0,0,0,765,
        629,1,0,0,0,765,630,1,0,0,0,765,631,1,0,0,0,765,632,1,0,0,0,765,
        633,1,0,0,0,765,634,1,0,0,0,765,635,1,0,0,0,765,636,1,0,0,0,765,
        637,1,0,0,0,765,641,1,0,0,0,765,652,1,0,0,0,765,663,1,0,0,0,765,
        674,1,0,0,0,765,682,1,0,0,0,765,689,1,0,0,0,765,690,1,0,0,0,765,
        697,1,0,0,0,765,704,1,0,0,0,765,712,1,0,0,0,765,719,1,0,0,0,765,
        726,1,0,0,0,765,727,1,0,0,0,765,728,1,0,0,0,765,735,1,0,0,0,765,
        747,1,0,0,0,765,758,1,0,0,0,766,97,1,0,0,0,767,768,5,96,0,0,768,
        99,1,0,0,0,769,770,7,0,0,0,770,771,5,8,0,0,771,776,3,14,7,0,772,
        773,5,3,0,0,773,775,3,14,7,0,774,772,1,0,0,0,775,778,1,0,0,0,776,
        774,1,0,0,0,776,777,1,0,0,0,777,779,1,0,0,0,778,776,1,0,0,0,779,
        780,5,10,0,0,780,794,1,0,0,0,781,782,7,0,0,0,782,783,5,2,0,0,783,
        788,3,14,7,0,784,785,5,3,0,0,785,787,3,14,7,0,786,784,1,0,0,0,787,
        790,1,0,0,0,788,786,1,0,0,0,788,789,1,0,0,0,789,791,1,0,0,0,790,
        788,1,0,0,0,791,792,5,4,0,0,792,794,1,0,0,0,793,769,1,0,0,0,793,
        781,1,0,0,0,794,101,1,0,0,0,795,796,5,91,0,0,796,797,5,8,0,0,797,
        802,3,104,52,0,798,799,5,3,0,0,799,801,3,104,52,0,800,798,1,0,0,
        0,801,804,1,0,0,0,802,800,1,0,0,0,802,803,1,0,0,0,803,805,1,0,0,
        0,804,802,1,0,0,0,805,806,5,10,0,0,806,820,1,0,0,0,807,808,5,91,
        0,0,808,809,5,2,0,0,809,814,3,104,52,0,810,811,5,3,0,0,811,813,3,
        104,52,0,812,810,1,0,0,0,813,816,1,0,0,0,814,812,1,0,0,0,814,815,
        1,0,0,0,815,817,1,0,0,0,816,814,1,0,0,0,817,818,5,4,0,0,818,820,
        1,0,0,0,819,795,1,0,0,0,819,807,1,0,0,0,820,103,1,0,0,0,821,822,
        3,124,62,0,822,824,3,94,47,0,823,825,3,22,11,0,824,823,1,0,0,0,824,
        825,1,0,0,0,825,827,1,0,0,0,826,828,3,26,13,0,827,826,1,0,0,0,827,
        828,1,0,0,0,828,105,1,0,0,0,829,830,5,61,0,0,830,831,5,8,0,0,831,
        832,3,94,47,0,832,833,5,3,0,0,833,834,3,94,47,0,834,835,5,10,0,0,
        835,107,1,0,0,0,836,841,3,124,62,0,837,838,5,18,0,0,838,840,3,124,
        62,0,839,837,1,0,0,0,840,843,1,0,0,0,841,839,1,0,0,0,841,842,1,0,
        0,0,842,109,1,0,0,0,843,841,1,0,0,0,844,858,3,112,56,0,845,858,3,
        114,57,0,846,858,3,116,58,0,847,858,3,118,59,0,848,858,3,120,60,
        0,849,858,3,122,61,0,850,858,5,66,0,0,851,852,5,84,0,0,852,858,3,
        118,59,0,853,854,5,56,0,0,854,855,3,118,59,0,855,856,3,124,62,0,
        856,858,1,0,0,0,857,844,1,0,0,0,857,845,1,0,0,0,857,846,1,0,0,0,
        857,847,1,0,0,0,857,848,1,0,0,0,857,849,1,0,0,0,857,850,1,0,0,0,
        857,851,1,0,0,0,857,853,1,0,0,0,858,111,1,0,0,0,859,861,5,13,0,0,
        860,859,1,0,0,0,860,861,1,0,0,0,861,862,1,0,0,0,862,863,5,101,0,
        0,863,113,1,0,0,0,864,866,5,13,0,0,865,864,1,0,0,0,865,866,1,0,0,
        0,866,867,1,0,0,0,867,868,5,102,0,0,868,115,1,0,0,0,869,871,5,13,
        0,0,870,869,1,0,0,0,870,871,1,0,0,0,871,872,1,0,0,0,872,873,5,103,
        0,0,873,117,1,0,0,0,874,875,5,104,0,0,875,119,1,0,0,0,876,877,5,
        105,0,0,877,121,1,0,0,0,878,879,7,5,0,0,879,123,1,0,0,0,880,884,
        5,107,0,0,881,884,5,106,0,0,882,884,3,126,63,0,883,880,1,0,0,0,883,
        881,1,0,0,0,883,882,1,0,0,0,884,125,1,0,0,0,885,886,7,6,0,0,886,
        127,1,0,0,0,113,131,138,146,150,152,156,158,170,181,187,190,193,
        199,202,204,215,222,227,232,236,239,242,249,257,266,278,293,300,
        312,320,326,331,334,339,343,347,353,357,361,368,372,377,379,389,
        397,401,412,415,419,424,449,460,474,479,491,504,510,515,519,530,
        537,545,552,561,568,571,576,580,584,588,592,596,603,610,612,617,
        622,624,626,639,646,650,657,661,668,672,680,687,695,702,710,717,
        724,733,740,745,752,763,765,776,788,793,802,814,819,824,827,841,
        857,860,865,870,883
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
    public check_expr(): Check_exprContext[];
    public check_expr(i: number): Check_exprContext | null;
    public check_expr(i?: number): Check_exprContext[] | Check_exprContext | null {
        if (i === undefined) {
            return this.getRuleContexts(Check_exprContext);
        }

        return this.getRuleContext(i, Check_exprContext);
    }
    public IN(): antlr.TerminalNode {
        return this.getToken(LogicalTypesParser.IN, 0)!;
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
