import { describe, expect, it } from 'vitest';
import { parseSinpatinhasQr, toRgba } from './qr';

describe('parseSinpatinhasQr', () => {
  it('lê o endereço sem "https://" (como vem no QR da carteira)', () => {
    expect(parseSinpatinhasQr('sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC.1D23.C-SP&tipo=RG_PET')).toEqual({
      rga: 'ABC.1D23.C-SP',
    });
  });
  it('também aceita com https:// e normaliza o RGA', () => {
    expect(parseSinpatinhasQr('https://sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=abc.1d23.c-sp')).toEqual({
      rga: 'ABC.1D23.C-SP',
    });
  });
  it.each([
    ['host parecido (golpe)', 'sinpatinhas.mma.gov.br.golpe.com/validacao-qr-code?nuRGA=ABC'],
    ['subdomínio', 'x.sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC'],
    ['usuário@host', 'https://sinpatinhas.mma.gov.br@golpe.com/validacao-qr-code?nuRGA=ABC'],
    ['caminho diferente', 'sinpatinhas.mma.gov.br/outra-coisa?nuRGA=ABC'],
    ['http sem criptografia', 'http://sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC'],
    ['esquema perigoso', 'javascript:alert(1)'],
    ['porta estranha', 'https://sinpatinhas.mma.gov.br:8443/validacao-qr-code?nuRGA=ABC'],
    ['sem nuRGA', 'sinpatinhas.mma.gov.br/validacao-qr-code?tipo=RG_PET'],
    ['nuRGA vazio', 'sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA='],
    ['texto qualquer', 'olá mundo'],
    ['vazio', ''],
  ])('recusa: %s', (_name, payload) => {
    expect(parseSinpatinhasQr(payload)).toBeNull();
  });
});

describe('toRgba', () => {
  it('converte RGB (3 canais) para RGBA com alfa 255', () => {
    const out = toRgba({ width: 2, height: 1, kind: 2, data: new Uint8ClampedArray([1, 2, 3, 4, 5, 6]) })!;
    expect(Array.from(out)).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
  });
  it('mantém RGBA como está', () => {
    const out = toRgba({ width: 1, height: 1, kind: 3, data: new Uint8ClampedArray([9, 8, 7, 6]) })!;
    expect(Array.from(out)).toEqual([9, 8, 7, 6]);
  });
  it('expande cinza de 1 bit (cada linha alinhada em bytes)', () => {
    // 3x2: linha 1 = 101, linha 2 = 010 (bits mais significativos primeiro)
    const out = toRgba({ width: 3, height: 2, kind: 1, data: new Uint8ClampedArray([0b10100000, 0b01000000]) })!;
    const red = Array.from(out).filter((_, i) => i % 4 === 0);
    expect(red).toEqual([255, 0, 255, 0, 255, 0]);
  });
  it('recusa dados incompletos', () => {
    expect(toRgba({ width: 4, height: 4, kind: 1, data: new Uint8ClampedArray(1) })).toBeNull();
    expect(toRgba({ width: 2, height: 2, kind: 2, data: new Uint8ClampedArray(5) })).toBeNull();
  });
});
