import 'i18next';
import type { resources } from '@/core/i18n/resources';

// Chaves de tradução tipadas: erro de digitação vira erro de compilação.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: (typeof resources)['pt-BR'];
    /** {{appName}} é preenchido sozinho (core/i18n/index.ts), não precisa passar em t(). */
    defaultVariables: { appName: string };
  }
}
