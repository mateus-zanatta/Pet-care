import { PDFDocument, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { RGA_POSITIONS } from '../positions';

/**
 * Gera um "RG Animal" FICTÍCIO com os valores nas posições da tabela real, para testes e para
 * você experimentar a importação sem usar o seu documento. Todos os dados abaixo são inventados.
 * (O layout real tem imagem de fundo, foto e 3 QR Codes; aqui há equivalentes.)
 */
export const FICTIONAL = {
  name: 'REX DE TESTE',
  rga: 'ABC.1D23.C-SP',
  microchip: 'Nao',
  neutered: 'Sim',
  species: 'Canina',
  birthDate: '15/03/2020',
  cor: 'Caramelo',
  sex: 'Macho',
  naturalidade: 'Campinas - SP',
  tutorName: 'FULANO DE TAL',
  document: '123.456.789-09', // CPF fictício: NUNCA pode aparecer no resultado
  phone: '19987654321',
  local: 'Campinas - SP',
  issuedOn: '01/10/2026',
} as const;

export type SyntheticOptions = {
  /** Sobrescreve valores; `null` omite o campo. */
  values?: Partial<Record<keyof typeof FICTIONAL, string | null>>;
  /** Linhas extras logo abaixo de um campo (nome longo que quebrou). */
  continuation?: { field: 'name' | 'tutorName'; lines: string[] };
  /** Texto de itens fora de qualquer posição conhecida. */
  strayItems?: number;
  /** Texto dos 3 QR Codes. `null` = sem QR. Padrão: o endereço oficial com o RGA do documento. */
  qrText?: string | null;
  creator?: string;
  pages?: number;
  pageSize?: [number, number];
  withPhoto?: boolean;
};

export async function buildSyntheticRgaPdf(options: SyntheticOptions = {}): Promise<Uint8Array> {
  const values = { ...FICTIONAL, ...options.values } as Record<string, string | null>;
  const doc = await PDFDocument.create();
  doc.setCreator(options.creator ?? 'JasperReports Library version 6.20.0');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const [w, h] = options.pageSize ?? [595, 842];

  for (let n = 0; n < (options.pages ?? 1); n++) {
    const page = doc.addPage([w, h]);
    if (n > 0) continue;

    const put = (text: string, x: number, y: number) => page.drawText(text, { x, y, size: 5, font });
    for (const [key, pos] of Object.entries(RGA_POSITIONS)) {
      const value = values[key];
      if (value) put(value, pos.x, pos.y);
    }
    if (options.continuation) {
      const base = RGA_POSITIONS[options.continuation.field];
      options.continuation.lines.forEach((line, i) => put(line, base.x, base.y - 7 * (i + 1)));
    }
    for (let i = 0; i < (options.strayItems ?? 0); i++) put(`LIXO${i}`, 40, 300 + i * 20);

    // Fundo grande (equivalente ao fundo real com os rótulos impressos).
    const background = await sharp({ create: { width: 2000, height: 1600, channels: 3, background: '#fff4f4' } }).jpeg().toBuffer();
    page.drawImage(await doc.embedJpg(background), { x: 0, y: 0, width: w, height: h });

    if (options.withPhoto !== false) {
      const photo = await sharp({ create: { width: 385, height: 462, channels: 3, background: '#996633' } }).jpeg().toBuffer();
      page.drawImage(await doc.embedJpg(photo), { x: 30, y: 700, width: 80, height: 96 });
    }

    const qrText =
      options.qrText === undefined
        ? `sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=${values.rga ?? FICTIONAL.rga}&tipo=RG_PET`
        : options.qrText;
    if (qrText !== null) {
      const png = await QRCode.toBuffer(qrText, { width: 300, margin: 2 });
      const qr = await doc.embedPng(png);
      for (const x of [100, 250, 400]) page.drawImage(qr, { x, y: 40, width: 60, height: 60 });
    }
  }
  return doc.save();
}

/** PNG com um QR Code (para o modo "só imagem"). */
export async function buildQrPng(text: string, size = 400): Promise<Uint8Array> {
  return QRCode.toBuffer(text, { width: size, margin: 4 });
}
