import { describe, expect, it } from '@jest/globals';
import { create } from '@bufbuild/protobuf';
import { CelValidator } from '../../../rules/cel/cel-validator';
import { RuleError, ValidationRule } from '../../../serde/serde';
import { ValidationPersonSchema } from '../../serde/test/validation_widget_pb';

/**
 * Tests for CelValidator — the per-rule CEL semantics, independent of any walker.
 */
function rule(expr?: string, name = 'r', doc?: string, sql?: string): ValidationRule {
  return { name, doc, expr, sql }
}

describe('CelValidator results', () => {
  const cases: [string, any, boolean][] = [
    ['this >= 0', 30, true],
    ['this >= 0', -5, false],
    ['size(this) > 0', 'alice', true],
    ['size(this) > 0', '', false],
    ['this.age <= 150', { age: 30 }, true],
    ['this.age <= 150', { age: 200 }, false],
    ["this.startsWith('a')", 'alice', true],
    ["this in ['a', 'b']", 'a', true],
  ]

  it.each(cases)('evaluates %s', async (expr, value, expected) => {
    const validator = new CelValidator()
    expect(await validator.execute(rule(expr), null, value)).toBe(expected)
  })

  it('returns the string a rule produces as the failure message', async () => {
    const validator = new CelValidator()
    const expr = "this >= 0 ? '' : 'age must be positive, got ' + string(this)"
    // An empty string means the rule passed.
    expect(await validator.execute(rule(expr), null, 5)).toBe('')
    expect(await validator.execute(rule(expr), null, -5)).toBe('age must be positive, got -5')
  })

  it('binds now for every evaluation', async () => {
    const validator = new CelValidator()
    expect(await validator.execute(rule("now > timestamp('2000-01-01T00:00:00Z')"), null, 1)).toBe(true)
  })
})

describe('CelValidator error surfaces', () => {
  it('rejects a null value as a contract violation', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this > 0'), null, null))
      .rejects.toThrow(/received a null value/)
  })

  it('rejects a missing expression', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule(undefined), null, 1)).rejects.toThrow(/has no expression/)
  })

  it('reports an uncompilable expression', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this >= '), null, 1))
      .rejects.toThrow(/Could not compile validation rule 'r'/)
  })

  it('reports an unevaluatable expression', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this.nope > 0'), null, { a: 1 }))
      .rejects.toThrow(/Could not execute validation rule 'r'/)
  })

  it('includes the rule doc in an evaluation error when present', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this.nope > 0', 'r', 'some doc'), null, { a: 1 }))
      .rejects.toThrow(/Could not execute validation rule 'r' \(some doc\)/)
  })

  it('rejects a result that is neither bool nor string', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('1 + 1'), null, 1))
      .rejects.toThrow(/must return bool or string/)
  })

  it('reports an unnamed rule as unnamed', async () => {
    const validator = new CelValidator()
    await expect(validator.execute({ expr: undefined }, null, 1))
      .rejects.toThrow(/Validation rule 'unnamed' has no expression/)
  })

  it('surfaces failures as RuleError', async () => {
    const validator = new CelValidator()
    await expect(validator.execute(rule('this > 0'), null, null)).rejects.toBeInstanceOf(RuleError)
  })
})

describe('CelValidator protobuf values', () => {
  it('binds message fields', async () => {
    const validator = new CelValidator()
    const person = create(ValidationPersonSchema, { age: 30, name: 'Alice' })
    expect(await validator.execute(rule('this.age <= 150'), ValidationPersonSchema, person)).toBe(true)
    expect(await validator.execute(rule("this.name == 'Alice'"), ValidationPersonSchema, person)).toBe(true)
  })
})

describe('CelValidator caching', () => {
  it('caches one program per expression', async () => {
    const validator = new CelValidator()
    for (let i = 0; i < 5; i++) {
      await validator.execute(rule('this >= 0'), null, i)
    }
    await validator.execute(rule('this <= 100'), null, 1)
    expect(validator.cache.size).toBe(2)
  })
})
