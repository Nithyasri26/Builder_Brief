import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Lint setup for the project.
 *
 * `next lint` without a config drops into an interactive prompt, which breaks
 * any non-interactive run (CI, a script, an agent). This pins the rules
 * explicitly so `npm run lint` always behaves the same way.
 */
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**'],
  },
  {
    rules: {
      // The chat layer deliberately reads loosely-typed task data
      // (`task.data.amount`) and narrows it at the point of use.
      '@typescript-eslint/no-explicit-any': 'error',
      // Unused args prefixed with _ are intentional interface conformance.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];

export default config;
