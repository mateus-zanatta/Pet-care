import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.emu.test.ts', 'node_modules/**'],
    // Ler PDFs (pdf.js + sharp) pode demorar em máquinas mais lentas.
    testTimeout: 30000,
  },
});
