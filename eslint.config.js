const ESLintParser = require('@typescript-eslint/parser');
const prettierPlugin = require('eslint-plugin-prettier');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.{js,ts,jsx,tsx,cjs,cts,mjs,mts,html,vue}'],
    languageOptions: {
      parser: ESLintParser,
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...typescriptPlugin.configs.recommended.rules,
      ...prettierPlugin.configs.recommended.rules,
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          endOfLine: 'auto',
        },
      ],
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    ignores: [
      '**/node_modules/**',
      'packages/*/lib/**',
      'eslint.config.js',
      'packages/**/*.d.ts',
      'packages/**/*.js'
    ],
  },
];
