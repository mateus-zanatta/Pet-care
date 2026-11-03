import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Os testes compartilham o mesmo emulador: rodar um arquivo por vez.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
