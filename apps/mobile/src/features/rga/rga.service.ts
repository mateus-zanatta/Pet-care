import {
  RGA_MAX_BASE64_LENGTH,
  RGA_MAX_FILE_BYTES,
  type RgaImportRequest,
  type RgaImportResult,
  rgaImportResultSchema,
} from '@petcare/shared';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { callFunction } from '@/core/firebase/callable';
import { isNetworkError } from '@/core/firebase/callableProtocol';

export type RgaMime = RgaImportRequest['mimeType'];
export type PickedRgaFile = { base64: string; mimeType: RgaMime };

export class RgaFileError extends Error {
  constructor(public readonly code: 'unsupported' | 'too_large') {
    super(code);
    this.name = 'RgaFileError';
  }
}

/** Descobre o tipo pelo MIME informado pelo sistema ou, na falta dele, pela extensão do nome. */
export function detectMime(name: string, type?: string | null): RgaMime | null {
  const mime = (type ?? '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'image/jpeg' || mime === 'image/png') return mime;
  if (mime === 'image/jpg') return 'image/jpeg';
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

const IMAGE_MAX_SIDE = 2000;

/** Foto/print: reduz e recodifica em JPEG (tira a localização EXIF e cabe no limite de envio). */
async function prepareImageBase64(uri: string): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  context.resize({ width: IMAGE_MAX_SIDE });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!saved.base64) throw new RgaFileError('unsupported');
  return saved.base64;
}

/**
 * Abre o seletor de arquivos do sistema e prepara o arquivo para envio.
 * Devolve null se a pessoa cancelar. Lança RgaFileError para tipo não aceito ou arquivo grande.
 */
export async function pickRgaFile(): Promise<PickedRgaFile | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'] });
  if (picked.canceled) return null;

  const file = picked.result;
  const mimeType = detectMime(file.name, file.type);
  if (!mimeType) throw new RgaFileError('unsupported');

  if (mimeType === 'application/pdf') {
    if ((file.size ?? 0) > RGA_MAX_FILE_BYTES) throw new RgaFileError('too_large');
    return { base64: await file.base64(), mimeType };
  }

  const base64 = await prepareImageBase64(file.uri);
  if (base64.length > RGA_MAX_BASE64_LENGTH) throw new RgaFileError('too_large');
  return { base64, mimeType: 'image/jpeg' };
}

/** Envia o arquivo para a Cloud Function `importRga` e valida a resposta contra o contrato. */
export async function importRgaFile(file: PickedRgaFile): Promise<RgaImportResult> {
  const response = await callFunction<RgaImportRequest, unknown>('importRga', {
    fileBase64: file.base64,
    mimeType: file.mimeType,
  });
  return rgaImportResultSchema.parse(response);
}

/** Endereço de exibição da foto lida do RG (JPEG em base64): não precisa de arquivo temporário. */
export function rgaPhotoDataUri(photoJpegBase64: string): string {
  return `data:image/jpeg;base64,${photoJpegBase64}`;
}

export type RgaErrorKind = 'network' | 'accountRequired' | 'generic';

/** Traduz o erro da chamada em um dos textos de `rga:errors`. */
export function classifyImportError(error: unknown): RgaErrorKind {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'functions/permission-denied' || code === 'functions/unauthenticated') return 'accountRequired';
  if (isNetworkError(error)) return 'network';
  return 'generic';
}
