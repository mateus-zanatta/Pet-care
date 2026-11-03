/**
 * Ferramentas locais do RG Animal (rode pelo npm, na raiz do projeto):
 *   npm run rga:sample                    -> cria um RG Animal FICTÍCIO para você testar o app
 *   npm run rga:inspect -- "C:\\caminho\\seu.pdf"
 *                                         -> confere o SEU PDF real contra a tabela de posições
 *
 * PRIVACIDADE: o inspetor roda só no seu computador e NÃO imprime nenhum valor lido (nome, RGA,
 * CPF, telefone...): mostra apenas posições, tamanhos e o "formato" (A = letra, 9 = número).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RGA_POSITIONS, EXPECTED_PAGE, POSITION_TOLERANCE } from './positions';
import { mapRgaFields, type RawFields } from './mapRgaFields';
import { analyzeRgaFile } from './pipeline';
import { readRgaPdf } from './pdfReader';
import { buildQrPng, buildSyntheticRgaPdf } from './testing/syntheticPdf';
import { todayIso } from '@petcare/shared';

const FREE_TEXT = new Set(['name', 'tutorName', 'cor', 'naturalidade', 'local']);

/** "ABC.1D23.C-SP" -> "AAA.9A99.A-AA" (formato, sem valor). */
const shape = (text: string) => text.replace(/[A-Za-zÀ-ÿ]/g, 'A').replace(/\d/g, '9');

function describeValue(key: string, text: string): string {
  return FREE_TEXT.has(key) ? `${text.length} caracteres` : `${text.length} caracteres, formato ${shape(text)}`;
}

async function sample(): Promise<void> {
  const dir = path.resolve(process.cwd(), '../fixtures/rga-sample');
  mkdirSync(dir, { recursive: true });
  const pdf = path.join(dir, 'rga-ficticio.pdf');
  const png = path.join(dir, 'qr-ficticio.png');
  writeFileSync(pdf, await buildSyntheticRgaPdf());
  writeFileSync(
    png,
    await buildQrPng('sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=ABC.1D23.C-SP&tipo=RG_PET', 600),
  );
  console.log('Arquivos FICTÍCIOS criados (todos os dados são inventados):');
  console.log(`  PDF : ${pdf}`);
  console.log(`  QR  : ${png}`);
  console.log('Copie para o celular (cabo USB, Google Drive...) e use "Importar RG Animal" no app.');
}

async function inspect(file: string | undefined): Promise<void> {
  if (!file) {
    console.error('Uso: npm run rga:inspect -- "C:\\caminho\\do\\seu-rga.pdf"');
    process.exitCode = 1;
    return;
  }
  // O npm roda este comando dentro de /functions; caminhos relativos valem a partir de onde você digitou.
  const resolved = path.resolve(process.env.INIT_CWD ?? process.cwd(), file);
  if (!existsSync(resolved)) {
    console.error(`Arquivo não encontrado: ${resolved}`);
    console.error('Confira o caminho (dica: arraste o arquivo para dentro do terminal para colar o caminho completo).');
    console.error('Para testar sem o seu documento, gere um RG Animal FICTÍCIO primeiro:  npm run rga:sample');
    process.exitCode = 1;
    return;
  }
  const bytes = new Uint8Array(readFileSync(resolved));
  console.log(`Arquivo: ${bytes.length} bytes (limite do app: 5 MB)`);

  const read = await readRgaPdf(bytes);
  if (!read.ok) {
    console.log(`NÃO foi possível ler como RG Animal. Motivo: ${read.reason}${read.creator ? ` | Creator: ${read.creator}` : ''}`);
    if (read.detail) console.log(`Detalhe técnico: ${read.detail}`);
    return;
  }
  console.log(`Página única A4 (${EXPECTED_PAGE.width}x${EXPECTED_PAGE.height} pt): OK`);
  console.log(`Creator: ${read.creator ?? '(vazio)'}  ${read.creator?.startsWith('JasperReports') ? '(esperado)' : '<-- DIFERENTE do esperado (JasperReports...)'}`);
  console.log(`Itens de texto: ${read.items.length} | Imagens decodificadas: ${read.images.length}`);
  for (const img of read.images) console.log(`   imagem ${img.width}x${img.height} (tipo ${img.kind})`);

  const { raw, ignored, duplicates } = mapRgaFields(read.items);
  console.log(`\nCampo            posição esperada (x, y)   resultado`);
  for (const [key, pos] of Object.entries(RGA_POSITIONS)) {
    const value = raw[key as keyof RawFields];
    const status = value === undefined ? 'NÃO ENCONTRADO' : `ok (${describeValue(key, value)})`;
    console.log(`${key.padEnd(16)} (${String(pos.x).padStart(3)}, ${pos.y.toFixed(1)})  ±${POSITION_TOLERANCE}   ${status}`);
  }
  console.log(`\nItens ignorados: ${ignored} | duplicados: ${duplicates}`);
  if (ignored > 0) {
    console.log('Posições (sem valores) dos itens que NÃO casaram com a tabela:');
    const known = new Set<string>();
    for (const item of read.items) {
      const near = Object.values(RGA_POSITIONS).some(
        (p) => Math.abs(p.x - item.x) <= POSITION_TOLERANCE && Math.abs(p.y - item.y) <= POSITION_TOLERANCE,
      );
      if (!near && item.text.trim() !== '') known.add(`   x=${item.x.toFixed(1)} y=${item.y.toFixed(1)} (${item.text.trim().length} caracteres)`);
    }
    for (const line of known) console.log(line);
  }

  const result = await analyzeRgaFile({ bytes, mimeType: 'application/pdf', today: todayIso() });
  console.log(`\nResultado do app: ${result.recognized ? 'RECONHECIDO' : `NÃO reconhecido (${result.reason})`}`);
  console.log(`QR encontrado: ${result.qr.found ? 'sim' : 'não'}${result.qr.matches === undefined ? '' : `, RGA do QR confere com o texto: ${result.qr.matches ? 'sim' : 'NÃO'}`}`);
  console.log(`Foto do animal extraída: ${result.photoJpegBase64 ? 'sim' : 'não'}`);
  console.log(`Avisos: ${result.warnings.length ? result.warnings.join(', ') : '(nenhum)'}`);
  console.log(`Campos marcados "confira": ${result.confirm.length ? result.confirm.join(', ') : '(nenhum)'}`);
  console.log('\n(Nenhum valor do documento foi impresso.)');
}

const [command, argument] = process.argv.slice(2);
if (command === 'sample') await sample();
else if (command === 'inspect') await inspect(argument);
else console.log('Comandos: sample | inspect <arquivo.pdf>');
