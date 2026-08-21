// Copyright 2026 Confluent Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * The JSONPath subset used by `variants.path(v, path)` - a port of Java's `VariantPath`.
 * Supports:
 *   - `$`                    root
 *   - `$.field`              object field by identifier name
 *   - `$[i]`                 array element by non-negative integer index
 *   - `$["quoted key"]`      quoted key for non-identifier names
 *
 * Resolution failures (missing field, out-of-bounds index, type mismatch) return `null`;
 * malformed paths throw. Negative indices are rejected. Quoted-key escapes recognize only
 * `\\` and backslash + the enclosing quote; any other escape is a parse error rather than
 * being silently decoded (option B, matching the Java reference). Non-ASCII characters may
 * be written literally; for keys needing other escapes use `variants.field(v, key)`.
 */

import { Variant, VariantType } from "../../confluent/types/variant-utils";

type Segment = { field: string } | { index: number };

// Bounded parse cache: rules usually pass a literal path that recurs per record. Only
// successful parses are cached, so a malformed path throws on every call.
const PARSE_CACHE = new Map<string, Segment[]>();
const PARSE_CACHE_MAX = 1000;

const IDENT_START = /[\p{L}_]/u;
const IDENT_PART = /[\p{L}\p{N}_]/u;

export function walk(root: Variant, path: string): Variant | null {
  let current: Variant | null = root;
  for (const seg of parse(path)) {
    if (current === null) return null;
    if ("field" in seg) {
      current = current.getType() === VariantType.OBJECT
        ? current.getFieldByKey(seg.field) : null;
    } else {
      current = current.getType() === VariantType.ARRAY
        ? current.getElementAtIndex(seg.index) : null;
    }
  }
  return current;
}

export function parse(path: string): Segment[] {
  const cached = PARSE_CACHE.get(path);
  if (cached !== undefined) return cached;
  const segments = parseInternal(path);
  if (PARSE_CACHE.size >= PARSE_CACHE_MAX) PARSE_CACHE.clear();
  PARSE_CACHE.set(path, segments);
  return segments;
}

function parseInternal(path: string): Segment[] {
  if (!path) throw new Error("variant path must start with '$'");
  const cur = new Cursor(path);
  if (cur.peek() !== "$") {
    throw new Error("variant path must start with '$', got: " + path);
  }
  cur.next();
  const out: Segment[] = [];
  while (cur.hasMore()) {
    const ch = cur.peek();
    if (ch === ".") {
      cur.next();
      out.push({ field: readIdent(cur, path) });
    } else if (ch === "[") {
      cur.next();
      if (!cur.hasMore()) {
        throw new Error("unexpected end of input after '[' in variant path: " + path);
      }
      if (cur.peek() === '"' || cur.peek() === "'") {
        out.push({ field: readQuotedKey(cur, path) });
      } else {
        out.push({ index: readIndex(cur, path) });
      }
      if (!cur.hasMore() || cur.next() !== "]") {
        throw new Error("expected ']' in variant path: " + path);
      }
    } else {
      throw new Error("unexpected character '" + ch + "' in variant path: " + path);
    }
  }
  return out;
}

function readIdent(cur: Cursor, path: string): string {
  if (!cur.hasMore() || !IDENT_START.test(cur.peek())) {
    throw new Error(
      "expected identifier (starting with a letter or '_') after '.' in variant path: " + path);
  }
  const start = cur.pos;
  cur.next();
  while (cur.hasMore() && IDENT_PART.test(cur.peek())) {
    cur.next();
  }
  return cur.src.slice(start, cur.pos);
}

function readQuotedKey(cur: Cursor, path: string): string {
  const quote = cur.next();
  let out = "";
  while (cur.hasMore()) {
    const ch = cur.next();
    if (ch === "\\") {
      // Only two escapes are recognized: a doubled backslash for a literal backslash, and
      // backslash + the enclosing quote for a literal quote. Any other escape - including a
      // would-be Unicode escape like backslash-u00e9 - is a parse error rather than being
      // silently decoded. Literal characters (including non-ASCII) pass through as-is.
      if (!cur.hasMore()) {
        throw new Error("unterminated escape at end of quoted key in variant path: " + path);
      }
      const esc = cur.next();
      if (esc === "\\" || esc === quote) {
        out += esc;
      } else {
        throw new Error(
          `unsupported escape '\\${esc}' in quoted key of variant path ` +
          `(only '\\\\' and '\\${quote}' are allowed): ${path}`);
      }
    } else if (ch === quote) {
      return out;
    } else {
      out += ch;
    }
  }
  throw new Error("unterminated quoted key in variant path: " + path);
}

function readIndex(cur: Cursor, path: string): number {
  if (cur.hasMore() && cur.peek() === "-") {
    throw new Error("negative indices are not supported in variant path: " + path);
  }
  const start = cur.pos;
  while (cur.hasMore() && cur.peek() >= "0" && cur.peek() <= "9") {
    cur.next();
  }
  if (cur.pos === start) {
    throw new Error("expected integer index in variant path: " + path);
  }
  return Number(cur.src.slice(start, cur.pos));
}

class Cursor {
  readonly src: string;
  pos: number;

  constructor(src: string) {
    this.src = src;
    this.pos = 0;
  }

  hasMore(): boolean {
    return this.pos < this.src.length;
  }

  peek(): string {
    return this.src[this.pos];
  }

  next(): string {
    return this.src[this.pos++];
  }
}
