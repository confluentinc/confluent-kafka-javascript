// Behavioral tests for checkSyntax, run against the built package (dist/).
// Positions follow ANTLR conventions: `line` is 1-based, `column` is 0-based.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSyntax } from "../dist/index.js";

test("valid DDL", async (t) => {
    const cases = {
        "README example": `
  NAMESPACE com.example;
  STRUCT Foo ( bar STRING NOT NULL );
  TYPE Foo;
`,
        "empty input": "",
        "lowercase keywords": "namespace com.example;\nstruct Foo ( bar string not null );\ntype Foo;",
        "multiple types with nested collections":
            "NAMESPACE com.example;\n" +
            "STRUCT Foo ( a INT, b ARRAY<STRING> );\n" +
            "STRUCT Bar ( foo Foo, m MAP<STRING, BIGINT> );\n" +
            "TYPE Bar;",
        "type alias": "NAMESPACE com.example;\nUSING TYPE Ext FOR com.other.Ext;\nSTRUCT Foo ( e Ext );\nTYPE Foo;",
    };
    for (const [name, source] of Object.entries(cases)) {
        await t.test(name, () => {
            assert.deepEqual(checkSyntax(source), { valid: true, errors: [] });
        });
    }
});

test("lexer error reports the unrecognized character", () => {
    const result = checkSyntax("NAMESPACE com.example;\nSTRUCT Foo ( bar STRING # );");
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors[0], {
        line: 2,
        column: 24,
        message: "token recognition error at: '#'",
    });
});

test("lexer error alone makes input invalid even if parsing recovers", () => {
    const result = checkSyntax("STRUCT Foo ( bar STRING NOT NULL ) ~");
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, [
        { line: 1, column: 35, message: "token recognition error at: '~'" },
    ]);
});

test("parser error on unterminated struct body", () => {
    const result = checkSyntax("STRUCT Foo ( bar STRING NOT NULL");
    assert.equal(result.valid, false);
    assert.deepEqual(result.errors, [
        { line: 1, column: 32, message: "mismatched input '<EOF>' expecting {',', ')'}" },
    ]);
});

test("parser error on missing field type", () => {
    const result = checkSyntax("STRUCT Foo ( bar );");
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].line, 1);
    assert.equal(result.errors[0].column, 17);
    assert.match(result.errors[0].message, /^mismatched input '\)' expecting \{.*\bSTRING\b.*\}$/);
});

test("trailing invalid input", async (t) => {
    await t.test("second TYPE statement", () => {
        const result = checkSyntax("STRUCT Foo ( bar STRING NOT NULL );\nTYPE Foo;\nTYPE Bar;");
        assert.equal(result.valid, false);
        assert.deepEqual(result.errors, [
            { line: 3, column: 0, message: "mismatched input 'TYPE' expecting <EOF>" },
        ]);
    });
    await t.test("stray identifier", () => {
        const result = checkSyntax("STRUCT Foo ( bar STRING );\nTYPE Foo;\nfoo");
        assert.equal(result.valid, false);
        assert.deepEqual(result.errors, [
            { line: 3, column: 0, message: "extraneous input 'foo' expecting <EOF>" },
        ]);
    });
});

test("multiline diagnostic positions", async (t) => {
    await t.test("parser error on a later line", () => {
        const result = checkSyntax("NAMESPACE com.example;\nSTRUCT Foo (\n  bar STRING NOT NULL,\n  baz\n);");
        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].line, 5);
        assert.equal(result.errors[0].column, 0);
        assert.match(result.errors[0].message, /^mismatched input '\)'/);
    });
    await t.test("lexer error column is relative to its line", () => {
        const result = checkSyntax("NAMESPACE com.example;\nSTRUCT Foo (\n    bar STRING # NOT NULL\n);");
        assert.equal(result.valid, false);
        assert.deepEqual(result.errors[0], {
            line: 3,
            column: 15,
            message: "token recognition error at: '#'",
        });
    });
    await t.test("multiple errors are reported in source order", () => {
        const result = checkSyntax("NAMESPACE com.example;\n\nSTRUCT Foo (\n  bar STRING NOT NULL,\n  baz ???\n);");
        assert.equal(result.valid, false);
        assert.deepEqual(
            result.errors.map(({ line, column }) => [line, column]),
            [[5, 6], [5, 7], [5, 8], [6, 0]],
        );
        assert.equal(result.errors[0].message, "token recognition error at: '?'");
    });
});
