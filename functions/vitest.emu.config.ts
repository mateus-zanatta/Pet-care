import { defineConfig } from 'vitest/config';

// Testes que precisam dos emuladores (Auth, Firestore, Storage): rode com `npm run test:emulators` na raiz.
export default defineConfig({
  test: { include: ['src/**/*.emu.test.ts'], fileParallelism: false, testTimeout: 30000 },
});
