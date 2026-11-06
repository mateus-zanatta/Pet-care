import { APP_NAME } from '@petcare/shared';
import { setupTestI18n } from '@/test/render';
import { resources } from './resources';

/** Lista todas as chaves de um objeto JSON aninhado como "a.b.c" (arrays contam como folhas). */
function keysOf(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keysOf(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Tira o sufixo de plural (_one/_other/_many...) para comparar idiomas com plurais diferentes. */
const normalize = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');

describe('traduções', () => {
  const namespaces = Object.keys(resources['pt-BR']) as (keyof (typeof resources)['pt-BR'])[];

  it.each(namespaces)('"%s" tem as mesmas chaves em português e inglês', (ns) => {
    const pt = new Set(keysOf(resources['pt-BR'][ns]).map(normalize));
    const en = new Set(keysOf(resources.en[ns]).map(normalize));
    expect([...pt].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !pt.has(k))).toEqual([]);
  });

  it('nenhum texto está vazio', () => {
    for (const lng of ['pt-BR', 'en'] as const) {
      for (const ns of namespaces) {
        const walk = (v: unknown, path: string) => {
          if (typeof v === 'string') expect({ path, empty: v.trim() === '' }).toEqual({ path, empty: false });
          else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
          else if (v && typeof v === 'object')
            Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`));
        };
        walk((resources[lng] as Record<string, unknown>)[ns], `${lng}.${ns}`);
      }
    }
  });

  it('a lista de seções legais tem o mesmo tamanho nos dois idiomas', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      expect(resources.en.legal[doc].sections.length).toBe(resources['pt-BR'].legal[doc].sections.length);
    }
  });
});

describe('nome do app (Tailwag)', () => {

  it('nenhum texto ainda usa o nome antigo', () => {
    expect(JSON.stringify(resources)).not.toMatch(/Pet Care/);
  });

  it('{{appName}} vira o nome do app em qualquer idioma', async () => {
    const i18n = await setupTestI18n('pt-BR');
    expect(i18n.t('appName')).toBe(APP_NAME);
    expect(i18n.t('legal:terms.sections.0.title' as never)).toContain(APP_NAME);
  });

  it('os textos lidos no build (nome embaixo do ícone) usam o mesmo nome', () => {
    for (const lang of ['pt-BR', 'en']) {
      const native = require(`@/locales/native/${lang}.json`) as { ios: { CFBundleDisplayName: string }; android: { app_name: string } };
      expect(native.ios.CFBundleDisplayName).toBe(APP_NAME);
      expect(native.android.app_name).toBe(APP_NAME);
    }
  });
});
