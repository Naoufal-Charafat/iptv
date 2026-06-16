import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

/**
 * Shared flat ESLint config for the client-iptv monorepo.
 *
 * Layers:
 *  - JS + TypeScript recommended rules for every package.
 *  - React (hooks + fast-refresh) rules scoped to frontend/.
 *  - Node globals scoped to backend/ and shared/.
 *  - Prettier last to disable any stylistic rules that would conflict.
 *
 * Stylistic conventions (quotes, semicolons, width) are owned by Prettier
 * (.prettierrc), matching the parent iptv repo: single quotes, no semicolons,
 * printWidth 100, no trailing comma, arrow parens avoided.
 */
export default tseslint.config(
  {
    // Global ignores (must be the only key in this object to apply globally).
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.db',
      '**/vite.config.ts.timestamp-*'
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Defaults applied to every TS/JS file in the workspace.
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ]
    }
  },

  {
    // Frontend: React + browser globals.
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },

  {
    // Backend + shared + tooling: Node globals.
    files: ['backend/**/*.ts', 'shared/**/*.ts', '*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Disable formatting-related rules; Prettier is the source of truth.
  prettier
)
