import js from "@eslint/js";
import globals from "globals";

export default [
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                axios: "readonly",
                grablessonsVue: "readonly",
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            "no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_$" },
            ],
            "no-constant-condition": ["error", { checkLoops: false }],
            "no-empty": ["error", { allowEmptyCatch: true }],
        },
    },
    {
        files: ["tests/**/*.js"],
        languageOptions: {
            sourceType: "module",
            globals: globals.node,
        },
    },
    {
        files: ["scripts/**/*.mjs"],
        languageOptions: {
            sourceType: "module",
            globals: globals.node,
        },
    },
];
