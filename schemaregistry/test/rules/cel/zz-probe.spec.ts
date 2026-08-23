import { describe, expect, it } from '@jest/globals';
import { CelValidator } from '../../../rules/cel/cel-validator';
import { ValidationRule } from '../../../serde/serde';

function rule(expr?: string): ValidationRule {
  return { name: 'p', expr }
}

const ev = async (expr: string): Promise<any> => {
  const v = new CelValidator()
  try {
    return await v.execute(rule(expr), null, 0)
  } catch (e) {
    return `ERR: ${(e as Error).message}`
  }
}

describe('PROBE', () => {
  it('measures', async () => {
    const exprs = [
      // ---- timestamp(int) semantics ----
      'string(int(timestamp(1700000000)))',
      'timestamp(1700000000) == timestamp("2023-11-14T22:13:20Z")',
      'timestamp(1700000000) == timestamp("1970-01-20T16:13:20Z")',
      'timestamp("2026-01-01T00:00:00Z") == timestamp("2026-01-01T00:00:00Z")',
      'timestamp(timestamp("2026-01-01T00:00:00Z")) == timestamp("2026-01-01T00:00:00Z")',
      'timestamp.of(1700000000000, "millis") == timestamp("2023-11-14T22:13:20Z")',
      'timestamp.of(1700000000, "seconds") == timestamp("2023-11-14T22:13:20Z")',
      'timestamp.of(timestamp("2026-01-01T00:00:00Z")) == timestamp("2026-01-01T00:00:00Z")',
      // ---- in on decimals ----
      'decimal(b"\\x14",1) in [decimal(b"\\x00\\xc8",2)]',
      'decimal(b"\\x14",1) == decimal(b"\\x00\\xc8",2)',
      'decimal(b"\\x14",1) in [decimal(b"\\x14",1)]',
      'decimal(b"\\x14",1) in [decimal(b"\\x15",1)]',
      '!(decimal(b"\\x14",1) in [decimal(b"\\x15",1)])',
      '[decimal(b"\\x14",1)] in [[decimal(b"\\x00\\xc8",2)]]',
      // ---- non-decimal in guards ----
      '1 in [1, 2]',
      '3 in [1, 2]',
      '"a" in ["a"]',
      '"a" in {"a": 1}',
      '"b" in {"a": 1}',
      'true in [true, false]',
      '[1] in [[1],[2]]',
      '1u in [1u]',
      '1.5 in [1.5]',
      'b"\\x01" in [b"\\x01"]',
      '1 in {1: "a"}',
      'true in {true: "a"}',
      '1.0 in {1.0: "a"}',
      '1u in {1u: "a"}',
    ]
    const out: string[] = []
    for (const e of exprs) {
      out.push(`${e}  =>  ${JSON.stringify(await ev(e))}`)
    }
    console.log('\nPROBE RESULTS\n' + out.join('\n'))
    expect(true).toBe(true)
  })
})
