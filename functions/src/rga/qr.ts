import { normalizeRga } from '@petcare/shared';
import jsQR from 'jsqr';
import { SINPATINHAS_HOST, SINPATINHAS_QR_PATH } from './positions';

/** Imagem decodificada pelo pdf.js (ImageKind: 1 = 1 bit cinza, 2 = RGB, 3 = RGBA). */
export type RawImage = { width: number; height: number; kind: number; data: Uint8ClampedArray };

const KIND_GRAY_1BPP = 1;

/** Converte os pixels do pdf.js (RGB, RGBA ou cinza 1 bit) para RGBA, que é o que o jsQR lê. */
export function toRgba({ width, height, kind, data }: RawImage): Uint8ClampedArray | null {
  const pixels = width * height;
  const rgba = new Uint8ClampedArray(pixels * 4);

  if (kind === KIND_GRAY_1BPP) {
    const rowBytes = Math.ceil(width / 8);
    if (data.length < rowBytes * height) return null;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const o = (y * width + x) * 4;
        rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
        rgba[o + 3] = 255;
      }
    }
    return rgba;
  }

  const channels = data.length / pixels;
  if (channels === 4) return new Uint8ClampedArray(data);
  if (channels === 3) {
    for (let i = 0, j = 0, k = 0; i < pixels; i++) {
      rgba[j++] = data[k++]!;
      rgba[j++] = data[k++]!;
      rgba[j++] = data[k++]!;
      rgba[j++] = 255;
    }
    return rgba;
  }
  if (channels === 1) {
    for (let i = 0, j = 0; i < pixels; i++) {
      const v = data[i]!;
      rgba[j++] = v;
      rgba[j++] = v;
      rgba[j++] = v;
      rgba[j++] = 255;
    }
    return rgba;
  }
  return null;
}

/** Lê um QR Code de uma imagem RGBA; devolve o texto ou null. */
export function decodeQrFromRgba(rgba: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

export function decodeQr(image: RawImage): string | null {
  const rgba = toRgba(image);
  return rgba ? decodeQrFromRgba(rgba, image.width, image.height) : null;
}

/**
 * Interpreta o texto do QR da carteira: `sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=<RGA>&tipo=RG_PET`
 * (sem "https://"). A conferência do endereço é EXATA (host e caminho): um golpe como
 * `sinpatinhas.mma.gov.br.golpe.com` não passa.
 */
export function parseSinpatinhasQr(payload: string): { rga: string } | null {
  const text = payload.trim();
  // Sem esquema (o normal) ou https. Qualquer outro esquema (http:, javascript:, host:porta...) é recusado.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text);
  if (hasScheme && !/^https:\/\//i.test(text)) return null;
  let url: URL;
  try {
    url = new URL(hasScheme ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (url.hostname !== SINPATINHAS_HOST || url.port !== '' || url.username !== '' || url.password !== '') return null;
  if (url.pathname !== SINPATINHAS_QR_PATH) return null;
  const rga = url.searchParams.get('nuRGA');
  if (!rga || rga.trim() === '') return null;
  return { rga: normalizeRga(rga) };
}
