import { describe, expect, it } from 'vitest';
import {
  RGA_FAILURE_REASONS,
  RGA_MAX_BASE64_LENGTH,
  RGA_MAX_FILE_BYTES,
  rgaImportRequestSchema,
  rgaImportResultSchema,
} from './rgaImport';

describe('rgaImportRequestSchema', () => {
  it('aceita PDF e imagens até o limite', () => {
    expect(rgaImportRequestSchema.safeParse({ fileBase64: 'A'.repeat(100), mimeType: 'application/pdf' }).success).toBe(true);
    expect(rgaImportRequestSchema.safeParse({ fileBase64: 'A'.repeat(100), mimeType: 'image/png' }).success).toBe(true);
  });
  it('rejeita outros tipos e arquivos grandes demais', () => {
    expect(rgaImportRequestSchema.safeParse({ fileBase64: 'A'.repeat(100), mimeType: 'text/html' }).success).toBe(false);
    expect(
      rgaImportRequestSchema.safeParse({ fileBase64: 'A'.repeat(RGA_MAX_BASE64_LENGTH + 1), mimeType: 'application/pdf' }).success,
    ).toBe(false);
  });
  it('o limite em base64 equivale a 5 MB do arquivo original', () => {
    expect(RGA_MAX_BASE64_LENGTH).toBeGreaterThanOrEqual(Math.floor((RGA_MAX_FILE_BYTES * 4) / 3));
    expect(RGA_MAX_BASE64_LENGTH).toBeLessThan(Math.floor((RGA_MAX_FILE_BYTES * 4) / 3) + 16);
  });
});

describe('rgaImportResultSchema', () => {
  it('aceita um resultado completo e NÃO tem campo para CPF/CNPJ', () => {
    const result = rgaImportResultSchema.parse({
      mode: 'pdf',
      recognized: true,
      fields: { name: 'Rex', rga: 'ABC.1D23.C-SP', species: 'dog', tutor: { nome: 'Fulano', telefone: '19999999999' } },
      confirm: ['microchip'],
      warnings: ['microchip_confirm'],
      qr: { found: true, rga: 'ABC.1D23.C-SP', matches: true },
    });
    expect(Object.keys(result.fields)).not.toContain('cpf');
    expect(JSON.stringify(rgaImportResultSchema.shape)).not.toMatch(/cpf|cnpj/i);
  });
  it('rejeita telefone fora de 10 ou 11 dígitos e motivos desconhecidos', () => {
    const base = { mode: 'pdf', recognized: false, confirm: [], warnings: [], qr: { found: false } };
    expect(rgaImportResultSchema.safeParse({ ...base, fields: { tutor: { telefone: '123' } } }).success).toBe(false);
    expect(rgaImportResultSchema.safeParse({ ...base, fields: {}, reason: 'qualquer' }).success).toBe(false);
    expect(RGA_FAILURE_REASONS).toContain('missing_required_fields');
  });
});
