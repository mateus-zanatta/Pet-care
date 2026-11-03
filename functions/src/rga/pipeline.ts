import {
  RGA_MAX_FILE_BYTES,
  type RgaFailureReason,
  type RgaImportResult,
  type RgaFieldKey,
  type RgaWarningCode,
  isRgaFormatValid,
  normalizeRga,
} from '@petcare/shared';
import sharp from 'sharp';
import { mapRgaFields } from './mapRgaFields';
import { normalizeRgaFields } from './normalize';
import { pickPhoto, isQrCandidate, toJpegBase64 } from './photo';
import { EXPECTED_CREATOR_PREFIX } from './positions';
import { readRgaPdf } from './pdfReader';
import { decodeQr, decodeQrFromRgba, parseSinpatinhasQr } from './qr';

export type AnalyzeInput = {
  bytes: Uint8Array;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  /** Data de hoje (ISO), usada para validar nascimento ≤ emissão ≤ hoje. */
  today: string;
  /** Recebe o motivo técnico quando a leitura falha (para log do servidor; nunca vai ao app). */
  onDiagnostic?: (detail: string) => void;
};

const emptyQr = { found: false } as const;

function failure(
  mode: RgaImportResult['mode'],
  reason: RgaFailureReason,
  extra: Partial<RgaImportResult> = {},
): RgaImportResult {
  return { mode, recognized: false, reason, fields: {}, confirm: [], warnings: [], qr: { ...emptyQr }, ...extra };
}

/**
 * Lê o arquivo enviado e devolve os campos do RG Animal (PDF) ou só o RGA do QR (imagem).
 * Nunca lança por causa do conteúdo do arquivo: arquivo estranho vira `recognized: false`
 * com um `reason`. NADA do que foi lido é registrado em log.
 */
export async function analyzeRgaFile({ bytes, mimeType, today, onDiagnostic }: AnalyzeInput): Promise<RgaImportResult> {
  if (bytes.byteLength > RGA_MAX_FILE_BYTES) return failure(mimeType === 'application/pdf' ? 'pdf' : 'qr', 'too_large');
  return mimeType === 'application/pdf' ? analyzePdf(bytes, today, onDiagnostic) : analyzeImage(bytes);
}

/* ------------------------------- PDF ------------------------------- */

async function analyzePdf(
  bytes: Uint8Array,
  today: string,
  onDiagnostic?: (detail: string) => void,
): Promise<RgaImportResult> {
  const read = await readRgaPdf(bytes);
  if (!read.ok) {
    if (read.detail) onDiagnostic?.(read.detail);
    return failure('pdf', read.reason, read.creator ? { creator: read.creator } : {});
  }

  const { raw, ignored } = mapRgaFields(read.items);
  const { fields, confirm: confirmList, warnings: warningList } = normalizeRgaFields(raw, today);
  const confirm = new Set<RgaFieldKey>(confirmList);
  const warnings = new Set<RgaWarningCode>(warningList);

  if (ignored > 0) warnings.add('ignored_items');
  if (!read.creator?.startsWith(EXPECTED_CREATOR_PREFIX)) warnings.add('creator_unexpected');

  // QR: confere se aponta para o SinPatinhas e se o RGA bate com o do texto.
  const qr: RgaImportResult['qr'] = { found: false };
  let unexpectedQr = false;
  for (const image of read.images.filter(isQrCandidate)) {
    const payload = decodeQr(image);
    if (payload === null) continue;
    const parsed = parseSinpatinhasQr(payload);
    if (parsed) {
      qr.found = true;
      qr.rga = parsed.rga;
      break;
    }
    unexpectedQr = true;
  }
  if (!qr.found) warnings.add(unexpectedQr ? 'qr_unexpected' : 'qr_missing');
  if (qr.found && qr.rga && fields.rga) {
    qr.matches = qr.rga === fields.rga;
    if (!qr.matches) {
      warnings.add('qr_mismatch'); // "este arquivo pode ter sido alterado"
      confirm.add('rga');
    }
  }

  // RGA ausente no texto, mas presente no QR: ajuda a preencher, sempre com "confira".
  if (!fields.rga && qr.rga) {
    fields.rga = qr.rga;
    confirm.add('rga');
    if (!isRgaFormatValid(qr.rga)) warnings.add('rga_format');
  }

  // Reconhecimento: nome, RGA (do texto) e espécie são obrigatórios.
  const missingRequired = !raw.name || !raw.rga || !fields.species;
  const photo = pickPhoto(read.images);
  const photoJpegBase64 = photo ? await toJpegBase64(photo) : null;

  const base = {
    mode: 'pdf' as const,
    ...(read.creator ? { creator: read.creator } : {}),
    fields,
    warnings: [...warnings],
    qr,
    ...(photoJpegBase64 ? { photoJpegBase64 } : {}),
  };

  if (missingRequired) {
    // "Não reconheci este arquivo": preenche o que der, tudo marcado "confira".
    const filled = (Object.keys(fields) as (keyof typeof fields)[]).flatMap((key): RgaFieldKey[] => {
      const map: Partial<Record<keyof typeof fields, RgaFieldKey>> = {
        name: 'name', rga: 'rga', microchip: 'microchip', neutered: 'neutered', species: 'species',
        sex: 'sex', birthDate: 'birthDate', cor: 'cor', naturalidade: 'naturalidade', issuedPlace: 'issuedPlace',
        issuedOn: 'issuedOn',
      };
      const mapped = map[key];
      return mapped ? [mapped] : [];
    });
    if (fields.tutor?.nome) filled.push('tutorName');
    if (fields.tutor?.telefone) filled.push('tutorPhone');
    return { ...base, recognized: false, reason: 'missing_required_fields', confirm: [...new Set([...confirm, ...filled])] };
  }

  return { ...base, recognized: true, confirm: [...confirm] };
}

/* ------------------------------ Imagem ------------------------------ */

/** Foto/print da carteira ou da plaquinha da coleira: lê só o QR e preenche o RGA. */
async function analyzeImage(bytes: Uint8Array): Promise<RgaImportResult> {
  let decoded: { data: Buffer; width: number; height: number };
  try {
    const { data, info } = await sharp(Buffer.from(bytes), { failOn: 'error', limitInputPixels: 80_000_000 })
      .rotate() // respeita a orientação da câmera
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    decoded = { data, width: info.width, height: info.height };
  } catch {
    return failure('qr', 'unreadable');
  }

  // Tenta o tamanho original e versões menores (fotos grandes às vezes só "enxergam" o QR reduzidas).
  let unexpected = false;
  for (const side of [0, 1600, 900, 500]) {
    let rgba = new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
    let { width, height } = decoded;
    if (side > 0 && Math.max(width, height) > side) {
      try {
        const resized = await sharp(decoded.data, { raw: { width, height, channels: 4 } })
          .resize({ width: side, height: side, fit: 'inside' })
          .raw()
          .toBuffer({ resolveWithObject: true });
        rgba = new Uint8ClampedArray(resized.data.buffer, resized.data.byteOffset, resized.data.byteLength);
        width = resized.info.width;
        height = resized.info.height;
      } catch {
        continue;
      }
    } else if (side > 0) {
      continue; // a imagem já é menor que este tamanho
    }

    const payload = decodeQrFromRgba(rgba, width, height);
    if (payload === null) continue;
    const parsed = parseSinpatinhasQr(payload);
    if (parsed) {
      const rga = normalizeRga(parsed.rga);
      const warnings: RgaWarningCode[] = isRgaFormatValid(rga) ? [] : ['rga_format'];
      return {
        mode: 'qr',
        recognized: true,
        fields: { rga },
        confirm: warnings.length ? ['rga'] : [],
        warnings,
        qr: { found: true, rga },
      };
    }
    unexpected = true;
  }

  return failure('qr', 'qr_not_found', {
    warnings: unexpected ? ['qr_unexpected'] : [],
    qr: { ...emptyQr },
  });
}
