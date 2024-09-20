const js = require("@eslint/js");
const jest = require('eslint-plugin-jest');
const ts = require('typescript-eslint');
const tsdoc = require('eslint-plugin-tsdoc');

const ckjsSpecificSettings = {
    languageOptions: {
        globals: {
            "require": "readonly",
            "module": "writable",
            "setImmediate": "readonly",
            "setTimeout": "readonly",
            "clearTimeout": "readonly",
            "setInterval": "readonly",
            "clearInterval": "readonly",
            "console": "readonly"
        }
    },
    "rules": {
        "eqeqeq": ["error", "always"],
        "no-use-before-define": ["error", "nofunc"],
        "no-caller": "error",
        "no-new": "error",
        "no-eq-null": "error",
        "no-trailing-spaces": "error",
        "no-constant-condition": "off",
        "semi": "error"
    }
};

const ckjsSpecificJestSettings = {
    "rules": {
       "jest/no-disabled-tests": "off",
       "jest/no-conditional-expect": "off",
    }
};

module.exports = ts.config(
    {
        ignores: ["**/dist/"]
    },
    {
        ...js.configs.recommended,
        files: ["lib/**/*.js", "test/promisified/**/*.js"],
        ignores: []
    },
    {
        ...ckjsSpecificSettings,
        files: ["lib/**/*.js", "test/promisified/**/*.js"],
        ignores: []
    },
    {
        ...jest.configs['flat/recommended'],
        files: ["test/promisified/**/*.js"]
    },
    {
        ...ckjsSpecificJestSettings,
        files: ["test/promisified/**/*.js"]
    },
    ...ts.configs.recommended.map((config) => ({
        ...config,
        ignores: ["**/*.js", "types/rdkafka.d.ts", "types/kafkajs.d.ts", "types/config.d.ts"],
        plugins: {
            "@typescript-eslint": ts.plugin,
            tsdoc,
        },
        rules: {
            ...config.rules,
            "prefer-const": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "tsdoc/syntax": "warn",
        }
    })),
);
