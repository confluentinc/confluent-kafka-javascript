# logical-types-checker

Syntax checker for the LogicalTypes DDL grammar (`grammar/LogicalTypes.g4`,
vendored from schema-registry's
`logical-types/src/main/antlr4/.../generated/LogicalTypes.g4`), generated
with [antlr-ng](https://www.antlr-ng.org) (ANTLR 4.13.x-compatible, matching
the version schema-registry's Java build pins) targeting the
[antlr4ng](https://github.com/mike-lischke/antlr4ng) TypeScript runtime.

This checks **syntax only** — pure grammar validity. It does not perform the
semantic checks the Java visitor applies (namespace/type resolution,
alias-chain rejection, nesting-gap checks, CHECK-expression function
whitelisting, etc.), so syntactically valid input here can still be rejected
by the real compiler.

Not published or wired into `@confluentinc/schemaregistry` — a standalone
dev tool with its own `package.json`.

## Usage

```ts
import { checkSyntax } from "./src/index.js";

const result = checkSyntax(`
  NAMESPACE com.example;
  STRUCT Foo ( bar STRING NOT NULL );
  TYPE Foo;
`);

// result.valid === true
// result.errors === []
```

On invalid input, `result.errors` is a list of `{ line, column, message }`.

## Demo page

```sh
npm install
npm run build:demo
```

Then open `demo/index.html` in a browser (or serve the `demo/` directory).
It's a textarea + "Check" button wired to `checkSyntax`.

## Regenerating the parser

If `grammar/LogicalTypes.g4` changes, first resync the vendored copy from
schema-registry, then regenerate:

```sh
cp ../../../schema-registry/logical-types/src/main/antlr4/io/confluent/kafka/schemaregistry/type/logical/generated/LogicalTypes.g4 grammar/LogicalTypes.g4
npm run generate
```

This regenerates `src/generated/`, which is committed.
