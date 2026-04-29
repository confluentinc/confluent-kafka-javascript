/** @type {import('jest').Config} */
//
// Jest config for the real-AWS integration test (e2e/auto-wire-real.e2e.ts).
//
// Invoked by `make e2e` via:
//   RUN_AWS_STS_REAL=1 ../node_modules/.bin/jest --config ./e2e/jest.config.js
//
// Default `npm test` (which uses ../jest.config.js) has `testRegex: 'test/.*'`,
// which deliberately does NOT match `e2e/*` files — that's the first layer of
// safety. The second layer is the `RUN_AWS_STS_REAL=1` env-var check inside
// the test file itself, which makes every `describe` block a `describe.skip`
// when the env var is absent.
//
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: 'e2e/.*\\.e2e\\.ts$',

  // No coverage on e2e — the unit suite owns coverage; e2e is wire-format
  // and SDK-round-trip verification.
  collectCoverage: false,

  // Real AWS calls can take a few hundred ms; 20s gives ample headroom for
  // the AWS SDK's chain-resolution + STS round-trip on a slow network.
  testTimeout: 20_000,
};
