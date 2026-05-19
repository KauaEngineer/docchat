import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import { reactConfig } from './react.js';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

/** @type {import("eslint").Linter.Config[]} */
export const nextConfig = [
  ...reactConfig,
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  // `next/core-web-vitals` força o parser babel-based do eslint-config-next em
  // todos os arquivos, o que faz rules type-aware (consistent-type-imports)
  // explodirem nos .ts/.tsx. Reaplicamos o parser do typescript-eslint
  // depois pra restaurar o que veio do baseConfig.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
];

export default nextConfig;
