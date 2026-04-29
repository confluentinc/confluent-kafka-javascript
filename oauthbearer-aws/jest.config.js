/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Default `npm test` only runs unit tests under ./test.
  // The e2e suite lives under ./e2e and is invoked by `make e2e`
  // (which sets RUN_AWS_STS_REAL=1).
  testRegex: 'test/.*\\.test\\.ts$',

  collectCoverage: true,
  coverageReporters: ['json', 'text', 'html'],
  coverageDirectory: 'coverage/',
};
