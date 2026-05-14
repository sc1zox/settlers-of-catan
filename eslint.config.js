// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

const unusedVarsRule = ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }];

const tsStylisticOverrides = {
  '@typescript-eslint/prefer-for-of': 'off',
};

module.exports = defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out-tsc/**',
      '**/.angular/**',
      '**/coverage/**',
      'apps/catan-api/webpack.config.js',
    ],
  },
  {
    files: ['apps/catan-client/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      prettier,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
      ...tsStylisticOverrides,
    },
  },
  {
    files: ['apps/catan-client/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  {
    files: ['apps/catan-api/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      prettier,
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
      ...tsStylisticOverrides,
    },
  },
  {
    files: ['libs/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      prettier,
    ],
    languageOptions: {
      globals: {
        ...globals.es2021,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': unusedVarsRule,
      ...tsStylisticOverrides,
    },
  },
]);
