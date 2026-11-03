import { RGA_MAX_FILE_BYTES, rgaImportResultSchema } from '@petcare/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { analyzeRgaFile } from './pipeline';
import { FICTIONAL, buildQrPng, buildSyntheticRgaPdf } from './testing/syntheticPdf';

const TODAY = '2026-11-03';
const analyzePdf = async (options?: Parameters<typeof buildSyntheticRgaPdf>[0]) =>
  analyzeRgaFile({ bytes: await buildSyntheticRgaPdf(options), mimeType: 'application/pdf', today: TODAY });

describe('analyzeRgaFile — PDF', () => {
  it('lê a carteira fictícia inteira: campos, QR e foto', async () => {
    const result = await analyzePdf();

    expect(rgaImportResultSchema.safeParse(result).success).toBe(true); // respeita o contrato
    expect(result).toMatchObject({
      mode: 'pdf',
      recognized: true,
      creator: 'JasperReports Library version 6.20.0',
      confirm: [],
      warnings: [],
      qr: { found: true, rga: 'ABC.1D23.C-SP', matches: true },
    });
    expect(result.fields).toEqual({
      name: 'REX DE TESTE',
      rga: 'ABC.1D23.C-SP',
      hasMicrochip: false,
      neutered: 'yes',
      species: 'dog',
      sex: 'male',
      birthDate: '2020-03-15',
      cor: 'Caramelo',
      naturalidade: { cidade: 'Campinas', uf: 'SP' },
      issuedPlace: { cidade: 'Campinas', uf: 'SP' },
      issuedOn: '2026-10-01',
      tutor: { nome: 'FULANO DE TAL', telefone: '19987654321' },
    });

    // A foto vem em JPEG, com as proporções da foto da carteira (385x462 -> reduzida)
    const jpeg = Buffer.from(result.photoJpegBase64!, 'base64');
    expect(jpeg.subarray(0, 3).toString('hex')).toBe('ffd8ff');
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.round((meta.width! / meta.height!) * 100)).toBe(Math.round((385 / 462) * 100));
  });

  it('PRIVACIDADE: o CPF do responsável não aparece em NENHUM lugar do resultado', async () => {
    const result = await analyzePdf();
    const json = JSON.stringify(result);
    expect(json).not.toContain('123.456.789-09');
    expect(json).not.toContain('12345678909');
    expect(json).not.toMatch(/cpf|cnpj|document/i);
  });

  it('microchip com número: guarda e pede confirmação', async () => {
    const result = await analyzePdf({ values: { microchip: '985112345678901' } });
    expect(result.recognized).toBe(true);
    expect(result.fields).toMatchObject({ hasMicrochip: true, microchip: '985112345678901' });
    expect(result.confirm).toContain('microchip');
    expect(result.warnings).toContain('microchip_confirm');
  });

  it('QR com RGA diferente do texto: avisa que o arquivo pode ter sido alterado', async () => {
    const result = await analyzePdf({ qrText: 'sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ZZZ.9999.Z-RJ&tipo=RG_PET' });
    expect(result.recognized).toBe(true);
    expect(result.qr).toMatchObject({ found: true, rga: 'ZZZ.9999.Z-RJ', matches: false });
    expect(result.warnings).toContain('qr_mismatch');
    expect(result.confirm).toContain('rga');
    expect(result.fields.rga).toBe(FICTIONAL.rga); // o do texto continua; a pessoa decide
  });

  it('sem QR, ou com QR de outro site: avisa, mas não bloqueia', async () => {
    const without = await analyzePdf({ qrText: null });
    expect(without.recognized).toBe(true);
    expect(without.warnings).toContain('qr_missing');
    expect(without.qr.found).toBe(false);

    const evil = await analyzePdf({ qrText: 'https://sinpatinhas.mma.gov.br.golpe.com/validacao-qr-code?nuRGA=ABC.1D23.C-SP' });
    expect(evil.recognized).toBe(true);
    expect(evil.warnings).toContain('qr_unexpected');
    expect(evil.qr.found).toBe(false);
  });

  it('gerador diferente de JasperReports: avisa (possível mudança de modelo), mas lê', async () => {
    const result = await analyzePdf({ creator: 'Microsoft Word' });
    expect(result.recognized).toBe(true);
    expect(result.warnings).toContain('creator_unexpected');
    expect(result.creator).toBe('Microsoft Word');
  });

  it('nome longo que quebrou em duas linhas é reunido', async () => {
    const result = await analyzePdf({ continuation: { field: 'name', lines: ['DE OLIVEIRA SANTOS'] } });
    expect(result.recognized).toBe(true);
    expect(result.fields.name).toBe('REX DE TESTE DE OLIVEIRA SANTOS');
  });

  it('itens de texto soltos viram aviso "ignored_items"', async () => {
    const result = await analyzePdf({ strayItems: 3 });
    expect(result.recognized).toBe(true);
    expect(result.warnings).toContain('ignored_items');
  });

  it('data de emissão no futuro é descartada com aviso', async () => {
    const result = await analyzePdf({ values: { issuedOn: '04/11/2026' } });
    expect(result.fields.issuedOn).toBeUndefined();
    expect(result.warnings).toContain('date_invalid');
    expect(result.confirm).toContain('issuedOn');
  });

  describe('"Não reconheci este arquivo": preenche o que der, tudo marcado "confira"', () => {
    it.each([
      ['sem nome', { name: null }],
      ['sem RGA', { rga: null }],
      ['sem espécie', { species: null }],
    ] as const)('%s', async (_label, values) => {
      const result = await analyzePdf({ values: values as never });
      expect(result.recognized).toBe(false);
      expect(result.reason).toBe('missing_required_fields');
      expect(result.fields.cor).toBe('Caramelo'); // o resto foi aproveitado
      expect(result.confirm).toEqual(expect.arrayContaining(['cor', 'sex']));
      expect(rgaImportResultSchema.safeParse(result).success).toBe(true);
    });

    it('sem RGA no texto mas com QR: sugere o RGA do QR, sempre com "confira"', async () => {
      const result = await analyzePdf({ values: { rga: null }, qrText: 'sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC.1D23.C-SP&tipo=RG_PET' });
      expect(result.recognized).toBe(false);
      expect(result.fields.rga).toBe('ABC.1D23.C-SP');
      expect(result.confirm).toContain('rga');
    });
  });

  describe('arquivos que não são a carteira', () => {
    it('mais de uma página', async () => {
      const result = await analyzePdf({ pages: 2 });
      expect(result).toMatchObject({ recognized: false, reason: 'multiple_pages' });
    });
    it('página de outro tamanho (não A4)', async () => {
      const result = await analyzePdf({ pageSize: [420, 595] });
      expect(result).toMatchObject({ recognized: false, reason: 'unexpected_page_size' });
    });
    it('arquivo que não é PDF', async () => {
      const result = await analyzeRgaFile({ bytes: Buffer.from('<html>oi</html>'), mimeType: 'application/pdf', today: TODAY });
      expect(result).toMatchObject({ recognized: false, reason: 'not_a_pdf' });
    });
    it('PDF corrompido', async () => {
      const result = await analyzeRgaFile({ bytes: Buffer.from('%PDF-1.7\n isto não é um pdf de verdade \u0000\u0001'), mimeType: 'application/pdf', today: TODAY });
      expect(result).toMatchObject({ recognized: false, reason: 'unreadable' });
    });
    it('arquivo acima de 5 MB', async () => {
      const result = await analyzeRgaFile({ bytes: new Uint8Array(RGA_MAX_FILE_BYTES + 1), mimeType: 'application/pdf', today: TODAY });
      expect(result).toMatchObject({ recognized: false, reason: 'too_large' });
    });
  });
});

describe('analyzeRgaFile — imagem (só o QR)', () => {
  const OFFICIAL = 'sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC.1D23.C-SP&tipo=RG_PET';

  it('lê o QR de um PNG e preenche só o RGA', async () => {
    const result = await analyzeRgaFile({ bytes: await buildQrPng(OFFICIAL), mimeType: 'image/png', today: TODAY });
    expect(result).toMatchObject({ mode: 'qr', recognized: true, fields: { rga: 'ABC.1D23.C-SP' }, qr: { found: true } });
    expect(rgaImportResultSchema.safeParse(result).success).toBe(true);
  });

  it('lê o QR mesmo numa foto grande com o QR pequeno no canto', async () => {
    const qr = await buildQrPng(OFFICIAL, 500);
    const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#cccccc' } })
      .composite([{ input: Buffer.from(qr), left: 2200, top: 1300 }])
      .jpeg({ quality: 85 })
      .toBuffer();
    const result = await analyzeRgaFile({ bytes: photo, mimeType: 'image/jpeg', today: TODAY });
    expect(result.recognized).toBe(true);
    expect(result.fields.rga).toBe('ABC.1D23.C-SP');
  });

  it('QR de outro endereço: não confia e avisa', async () => {
    const png = await buildQrPng('https://exemplo-golpe.com/pague-agora?nuRGA=ABC.1D23.C-SP');
    const result = await analyzeRgaFile({ bytes: png, mimeType: 'image/png', today: TODAY });
    expect(result).toMatchObject({ recognized: false, reason: 'qr_not_found' });
    expect(result.warnings).toContain('qr_unexpected');
    expect(result.fields.rga).toBeUndefined();
  });

  it('imagem sem QR ou arquivo estragado', async () => {
    const blank = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#ffffff' } }).png().toBuffer();
    expect(await analyzeRgaFile({ bytes: blank, mimeType: 'image/png', today: TODAY })).toMatchObject({
      recognized: false,
      reason: 'qr_not_found',
    });
    expect(await analyzeRgaFile({ bytes: Buffer.from('não sou imagem'), mimeType: 'image/jpeg', today: TODAY })).toMatchObject({
      recognized: false,
      reason: 'unreadable',
    });
  });
});
