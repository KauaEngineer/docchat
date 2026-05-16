import { FlatCompat } from '@eslint/eslintrc';
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
];

export default nextConfig;
