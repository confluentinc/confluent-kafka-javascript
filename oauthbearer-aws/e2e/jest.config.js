// Jest config for real-AWS end-to-end tests. Kept separate from the unit
// test config so `make test` never accidentally picks up e2e files.
//
// Run with:
//   RUN_AWS_STS_REAL=1 AWS_REGION=... AUDIENCE=... make -C oauthbearer-aws e2e
//
// Any `.e2e.ts` file that does NOT check the env-var gate will simply mint
// a real STS token when run — deliberate, so dry-run scenarios are obvious.
module.exports = {
    rootDir: '..',
    testMatch: ['<rootDir>/e2e/**/*.e2e.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    collectCoverage: false,
    testTimeout: 20000,
};
