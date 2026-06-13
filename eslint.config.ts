import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin'
import { defineConfig } from 'eslint/config';

export default defineConfig([
    { ignores: ['dist/**', 'scratchpad/**'] },
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
        plugins: { js },
        extends: ['js/recommended'],
        languageOptions: { globals: globals.node }
    },
    {
        files: ['tests/**/*.test.{js,ts}'],
        plugins: { vitest, js },
        extends: ['js/recommended'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...vitest.environments.env.globals
            },
        }
    },
    tseslint.configs.recommended,
    {
        rules: {
            'array-bracket-spacing': 'off',
            'arrow-parens': ['error', 'always'],
            'brace-style': 'off',
            'class-methods-use-this': 'off',
            'consistent-return': 'off',
            'default-param-last': 'off',
            'eslint-comments/require-description': 'off',
            'func-style': 'off',
            'function-call-argument-newline': 'off',
            'function-paren-newline': 'off',
            'guard-for-in': 'off',
            'lines-around-comment': 'off',
            'max-statements-per-line': 'off',
            'n/no-extraneous-require': 'off',
            'n/no-missing-import': 'off',
            'n/shebang': 'off',
            'new-cap': 'off',
            'no-alert': 'off',
            'no-confusing-arrow': 'off',
            'no-invalid-this': 'off',
            'no-multi-str': 'off',
            'no-param-reassign': 'off',
            'no-undefined': 'off',
            'no-underscore-dangle': 'off',
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-use-before-define': 'off',
            'object-curly-newline': 'off',
            'object-property-newline': 'off',
            'object-shorthand': 'off',
            'operator-linebreak': ['error', 'after'],
            'padding-line-between-statements': 'off',
            'prefer-arrow-callback': 'off',
            'prefer-const': 'off',
            'prefer-exponentiation-operator': 'off',
            'prefer-rest-params': 'off',
            'prefer-spread': 'off',
            'quote-props': 'off',
            'require-unicode-regexp': 'off',
            'space-before-function-paren': 'off',
            'unicorn/prefer-array-flat': 'off',
            'unicorn/prefer-includes': 'off',
            'unicorn/prefer-set-has': 'off',
            'wrap-iife': 'off',
            camelcase: 'off',
            quotes: ['error', 'single', { avoidEscape: true }],
            strict: 'off'
        }
    },
    {
        files: ['**/*.{ts,mts,cts}'],
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }]
        }
    }
]);
