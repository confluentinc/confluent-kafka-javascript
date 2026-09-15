import {
    BaseErrorListener,
    CharStream,
    CommonTokenStream,
    type ATNSimulator,
    type Recognizer,
    type Token,
} from "antlr4ng";
import { LogicalTypesLexer } from "./generated/LogicalTypesLexer.js";
import { LogicalTypesParser } from "./generated/LogicalTypesParser.js";

export interface SyntaxError {
    line: number;
    column: number;
    message: string;
}

export interface CheckSyntaxResult {
    valid: boolean;
    errors: SyntaxError[];
}

class CollectingErrorListener extends BaseErrorListener {
    public readonly errors: SyntaxError[] = [];

    public override syntaxError<S extends Token, T extends ATNSimulator>(
        _recognizer: Recognizer<T>,
        _offendingSymbol: S | null,
        line: number,
        column: number,
        message: string,
    ): void {
        this.errors.push({ line, column, message });
    }
}

/**
 * Checks whether `source` is syntactically valid LogicalTypes DDL.
 *
 * This validates grammar-level syntax only. It does not perform the semantic
 * checks the Java visitor applies (namespace/type resolution, alias-chain
 * rejection, nesting-gap checks, CHECK-expression function whitelisting,
 * etc.) — syntactically valid input can still be semantically invalid.
 */
export function checkSyntax(source: string): CheckSyntaxResult {
    const errorListener = new CollectingErrorListener();

    const inputStream = CharStream.fromString(source);
    const lexer = new LogicalTypesLexer(inputStream);
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);

    const tokenStream = new CommonTokenStream(lexer);
    const parser = new LogicalTypesParser(tokenStream);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    parser.script();

    return {
        valid: errorListener.errors.length === 0,
        errors: errorListener.errors,
    };
}
