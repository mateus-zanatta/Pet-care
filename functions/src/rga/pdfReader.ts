import path from 'node:path';
import { type RgaFailureReason } from '@petcare/shared';
import { EXPECTED_PAGE } from './positions';
import { type RawImage } from './qr';
import { type TextItem, extractTextItems } from './textItems';

/** No máximo esta quantidade de imagens é lida (a carteira real tem 5: fundo, foto e 3 QRs). */
const MAX_IMAGES = 12;
/** Tempo máximo esperando o pdf.js decodificar cada imagem. */
const IMAGE_TIMEOUT_MS = 8000;
/** Imagens acima deste total de pixels não são decodificadas (proteção de memória; o fundo real tem ≈15 Mpx). */
const MAX_IMAGE_PIXELS = 30_000_000;

export type PdfReadOk = {
  ok: true;
  creator: string | undefined;
  items: TextItem[];
  images: RawImage[];
};
export type PdfReadFailure = {
  ok: false;
  reason: RgaFailureReason;
  creator?: string;
  /** Motivo técnico (sem valores do documento), só para log do servidor e para o `rga:inspect`. */
  detail?: string;
};

/**
 * O pdf.js exige que estes caminhos terminem com "/" (senão lança "must include trailing slash").
 * No Windows o separador do sistema é "\\", então normalizamos para "/" (o `fs.readFile` aceita).
 */
export function toFactoryUrl(dir: string): string {
  return `${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/`;
}

/** Pasta de dados do pdf.js (wasm, fontes...). Em ambientes sem `require` (testes ESM) fica indefinida. */
export function pdfjsAssetDir(name: 'wasm' | 'iccs' | 'cmaps' | 'standard_fonts'): string | undefined {
  try {
    return toFactoryUrl(path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), name));
  } catch {
    return undefined;
  }
}

/** Texto curto e seguro do erro (nome + mensagem, só caracteres comuns) para diagnóstico. */
export function describeError(error: unknown): string {
  const e = error as { name?: unknown; message?: unknown } | null;
  const text = `${typeof e?.name === 'string' ? e.name : 'Error'}: ${typeof e?.message === 'string' ? e.message : String(error)}`;
  return text.replace(/[^A-Za-z0-9 .:_()/'"-]/g, '?').slice(0, 160);
}

function sanitizeCreator(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Só o nome do gerador do documento; qualquer coisa fora deste alfabeto é descartada (não vira log).
  const cleaned = value.replace(/[^A-Za-z0-9 ._()/+-]/g, '').slice(0, 80).trim();
  return cleaned || undefined;
}

/**
 * Lê o PDF do RG Animal com o pdf.js (build "legacy", para Node), de forma defensiva:
 * `isEvalSupported: false` sempre (proteção contra PDF malicioso; a v6 do pdf.js nem tem mais
 * esse caminho, mas a opção fica para o caso de a dependência ser trocada), sem fontes do
 * sistema e sem XFA. Só aceita 1 página A4.
 */
export async function readRgaPdf(bytes: Uint8Array): Promise<PdfReadOk | PdfReadFailure> {
  const header = Buffer.from(bytes.subarray(0, 1024)).toString('latin1');
  if (!header.includes('%PDF-')) return { ok: false, reason: 'not_a_pdf' };

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let task: ReturnType<typeof pdfjs.getDocument> | undefined;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(bytes), // cópia: o pdf.js assume a posse do buffer
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      enableXfa: false,
      verbosity: 0,
      maxImageSize: MAX_IMAGE_PIXELS,
      wasmUrl: pdfjsAssetDir('wasm'),
      iccUrl: pdfjsAssetDir('iccs'),
      cMapUrl: pdfjsAssetDir('cmaps'),
      standardFontDataUrl: pdfjsAssetDir('standard_fonts'),
    } as Parameters<typeof pdfjs.getDocument>[0]);
    const pdf = await task.promise;

    const metadata = await pdf.getMetadata().catch(() => null);
    const creator = sanitizeCreator((metadata?.info as { Creator?: unknown } | undefined)?.Creator);

    if (pdf.numPages !== 1) return { ok: false, reason: 'multiple_pages', creator };

    const page = await pdf.getPage(1);
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view;
    const width = x1 - x0;
    const height = y1 - y0;
    const { width: w, height: h, tolerance } = EXPECTED_PAGE;
    if (Math.abs(width - w) > tolerance || Math.abs(height - h) > tolerance) {
      return { ok: false, reason: 'unexpected_page_size', creator };
    }

    const items = await extractTextItems(pdf);

    // Imagens: pdf.js as decodifica ao montar a lista de operações; depois pegamos cada uma pelo nome.
    const operators = await page.getOperatorList();
    const ids = new Set<string>();
    for (let i = 0; i < operators.fnArray.length; i++) {
      const fn = operators.fnArray[i];
      if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintImageXObjectRepeat) {
        const id = operators.argsArray[i]?.[0];
        if (typeof id === 'string') ids.add(id);
      }
    }

    const images: RawImage[] = [];
    for (const id of [...ids].slice(0, MAX_IMAGES)) {
      const image = await new Promise<RawImage | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS);
        page.objs.get(id, (obj: unknown) => {
          clearTimeout(timer);
          const o = obj as Partial<RawImage> | null;
          resolve(o?.data && o.width && o.height && o.kind ? (o as RawImage) : null);
        });
      });
      if (image) images.push(image);
    }

    return { ok: true, creator, items, images };
  } catch (error) {
    return { ok: false, reason: 'unreadable', detail: describeError(error) };
  } finally {
    await task?.destroy().catch(() => undefined);
  }
}
