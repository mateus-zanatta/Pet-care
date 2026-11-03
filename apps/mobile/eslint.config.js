const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'android/*', 'ios/*', 'coverage/*']),
  expoConfig,
  {
    // Nenhum texto fixo nas telas: tudo vem das traduções (src/locales).
    files: ['src/app/**/*.tsx', 'src/features/**/*.tsx', 'src/components/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
  {
    // Em testes, jest.mock() precisa de require() dentro da fábrica,
    // e i18n.use / i18n.changeLanguage é a API padrão do i18next.
    files: ['jest.setup.ts', 'src/test/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-named-as-default-member': 'off',
    },
  },
]);
