module.exports = {
    roots: ["."],
    testMatch: ["<rootDir>/test/**/*.test.ts"],
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },
    collectCoverage: true,
    coverageReporters: ['json', 'text', 'html'],
    coverageDirectory: 'coverage/jest/',
};
