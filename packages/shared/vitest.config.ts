import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os horários das doses seguem o relógio local do aparelho: os testes fixam um fuso para dar o mesmo resultado em qualquer PC.
    env: { TZ: 'America/Sao_Paulo' },
  },
});
