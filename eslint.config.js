const js = require("@eslint/js");
const jest = require('eslint-plugin-jest');

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

module.exports = [
    {
        ...js.configs.recommended,
        files: ["lib/**/*.js", "test/promisified/**/*.js"],
        ignores: ["lib/kafkajs/_heap.js"]
    },
    {
        ...ckjsSpecificSettings,
        files: ["lib/**/*.js", "test/promisified/**/*.js"],
        ignores: ["lib/kafkajs/_heap.js"]
    },
    {
        ...jest.configs['flat/recommended'],
        files: ["test/promisified/**/*.js"]
    },
    {
        ...ckjsSpecificJestSettings,
        files: ["test/promisified/**/*.js"]
    }
];
