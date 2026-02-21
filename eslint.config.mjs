import globals from 'globals';
import pluginJs from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      'no-var': 'warn',
      'prefer-const': 'warn',
    },
  },
  pluginJs.configs.recommended,
  eslintPluginPrettier,
  eslintConfigPrettier,
];
