import sharp from 'sharp';
import type { RawImage } from './qr';

const MIN_SIDE = 100;
/** A foto do animal tem ≈0,18 Mpx; o fundo da carteira ≈15 Mpx. */
const MAX_PHOTO_PIXELS = 2_000_000;
const OUTPUT_MAX_SIDE = 800;

/** Imagem pequena e (quase) quadrada = candidata a QR Code. */
export function isQrCandidate(image: RawImage): boolean {
  const { width, height } = image;
  return width >= 60 && width <= 1200 && Math.abs(width - height) <= Math.max(2, width * 0.03);
}

/** A foto é a maior imagem NÃO quadrada e pequena (nem o fundo gigante, nem os QRs). */
export function pickPhoto(images: readonly RawImage[]): RawImage | null {
  let best: RawImage | null = null;
  for (const image of images) {
    const { width, height } = image;
    if (width < MIN_SIDE || height < MIN_SIDE) continue;
    if (width * height > MAX_PHOTO_PIXELS) continue;
    if (isQrCandidate(image)) continue;
    if (!best || width * height > best.width * best.height) best = image;
  }
  return best;
}

/** Converte os pixels do pdf.js em JPEG (base64). A recodificação também descarta qualquer metadado. */
export async function toJpegBase64(image: RawImage): Promise<string | null> {
  const pixels = image.width * image.height;
  const channels = image.data.length / pixels;
  if (image.kind === 1 || (channels !== 1 && channels !== 3 && channels !== 4)) return null; // 1 bit: não é foto
  try {
    const jpeg = await sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength), {
      raw: { width: image.width, height: image.height, channels: channels as 1 | 3 | 4 },
    })
      .resize({ width: OUTPUT_MAX_SIDE, height: OUTPUT_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return jpeg.toString('base64');
  } catch {
    return null;
  }
}
