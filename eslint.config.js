import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore patterns first
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'docs/**',
      '*.js',
      '*.mjs',
      '*.cjs',
      '!eslint.config.js',
      '*.config.ts',
      '*.config.js',
    ],
  },
  
  // Base ESLint recommended rules
  eslint.configs.recommended,
  
  // TypeScript ESLint recommended rules
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  
  // Global configuration
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  
  // Source files configuration
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/__tests__/**'],
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      
      // General code quality rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
);

