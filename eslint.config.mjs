import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/android/**',
      '**/ios/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/.expo/**',
      'artifacts/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser, __DEV__: 'readonly' } },
    settings: { react: { version: '19.3' } },
  },
  { files: ['**/*.cjs', '**/*.mjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    files: ['**/*.tsx'],
    plugins: { react, 'react-hooks': hooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...hooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      'react/prop-types': 'off',
    },
  },
);
