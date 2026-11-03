import { describe, expect, it } from 'vitest';
import { buildSinpatinhasValidationUrl, isRgaFormatValid, normalizeRga } from './rga';

describe('RGA', () => {
  it('reconhece o formato XXX.XXXX.X-UF', () => {
    expect(isRgaFormatValid('ABC.1D23.C-SP')).toBe(true);
    expect(isRgaFormatValid('  abc.1d23.c-sp ')).toBe(true);
  });
  it('rejeita formatos diferentes (apenas aviso na interface)', () => {
    expect(isRgaFormatValid('ABC1D23C-SP')).toBe(false);
    expect(isRgaFormatValid('AB.1D23.C-SP')).toBe(false);
    expect(isRgaFormatValid('')).toBe(false);
  });
  it('normaliza para maiúsculas', () => {
    expect(normalizeRga(' abc.1d23.c-sp ')).toBe('ABC.1D23.C-SP');
  });
  it('monta a URL oficial de validação com o nuRGA codificado', () => {
    expect(buildSinpatinhasValidationUrl('abc.1d23.c-sp')).toBe(
      'https://sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC.1D23.C-SP&tipo=RG_PET',
    );
    expect(buildSinpatinhasValidationUrl('A&B')).toContain('nuRGA=A%26B');
  });
});
