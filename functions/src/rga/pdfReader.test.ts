import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeError, pdfjsAssetDir, readRgaPdf, toFactoryUrl } from './pdfReader';

describe('toFactoryUrl (o pdf.js exige "/" no final; no Windows o separador é "\\")', () => {
  it('converte caminhos do Windows para "/" e garante a barra final', () => {
    const windows = path.win32.join('C:\\Users\\elian\\Desktop\\pet-care-fase1\\node_modules\\pdfjs-dist', 'wasm');
    expect(windows).toContain('\\'); // é mesmo um caminho do Windows
    expect(toFactoryUrl(windows)).toBe('C:/Users/elian/Desktop/pet-care-fase1/node_modules/pdfjs-dist/wasm/');
  });
  it('mantém caminhos do Linux e não duplica a barra final', () => {
    expect(toFactoryUrl('/srv/app/node_modules/pdfjs-dist/wasm')).toBe('/srv/app/node_modules/pdfjs-dist/wasm/');
    expect(toFactoryUrl('/srv/app/wasm/')).toBe('/srv/app/wasm/');
    expect(toFactoryUrl('C:\\a\\b\\')).toBe('C:/a/b/');
  });
  it('em QUALQUER sistema, as pastas reais do pdf.js saem com "/" no final e sem "\\"', () => {
    for (const name of ['wasm', 'iccs', 'cmaps', 'standard_fonts'] as const) {
      const dir = pdfjsAssetDir(name);
      if (dir === undefined) continue; // ambiente sem require.resolve
      expect(dir.endsWith('/')).toBe(true);
      expect(dir).not.toContain('\\');
    }
  });
});

describe('diagnóstico da leitura', () => {
  it('um PDF corrompido falha com "unreadable" E explica o motivo técnico', async () => {
    const result = await readRgaPdf(Buffer.from('%PDF-1.7\n isto não é um pdf de verdade \u0000'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unreadable');
      expect(result.detail).toMatch(/\w+Exception|Error/);
    }
  });
  it('o texto do diagnóstico é curto e só tem caracteres comuns', () => {
    const text = describeError(Object.assign(new Error('falha ' + 'x'.repeat(500) + ' \u0000 <script>'), { name: 'FooException' }));
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text).toMatch(/^FooException: /);
    expect(text).not.toMatch(/[<>\u0000]/);
  });
});
