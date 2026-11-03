import { z } from 'zod';
import { BR_UF } from '../enums';
import { isValidIsoDate } from '../dates';

/**
 * Contrato da importação do RG Animal (SinPatinhas) entre a Cloud Function `importRga` e o app.
 *
 * REGRAS DE PRIVACIDADE (LGPD), garantidas por testes na função:
 *  - CPF/CNPJ do responsável NUNCA aparece neste contrato (é descartado logo após a leitura);
 *  - nome e telefone do responsável só viajam em `fields.tutor` e só são salvos se a pessoa confirmar;
 *  - nenhum valor do RG vai para logs, Sentry ou PostHog — só os códigos de `reason` e `warnings`.
 */

export const RGA_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB (PDF ou imagem)
/** Base64 cresce ~4/3 em relação ao arquivo original. */
export const RGA_MAX_BASE64_LENGTH = Math.ceil((RGA_MAX_FILE_BYTES * 4) / 3) + 8;
export const RGA_ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const rgaImportRequestSchema = z.object({
  fileBase64: z.string().min(16).max(RGA_MAX_BASE64_LENGTH),
  mimeType: z.enum(RGA_ACCEPTED_MIME_TYPES),
});
export type RgaImportRequest = z.infer<typeof rgaImportRequestSchema>;

/** Campos que a importação pode preencher (e que podem receber o selo "confira"). */
export const RGA_FIELD_KEYS = [
  'name',
  'rga',
  'microchip',
  'neutered',
  'species',
  'birthDate',
  'cor',
  'sex',
  'naturalidade',
  'tutorName',
  'tutorPhone',
  'issuedPlace',
  'issuedOn',
] as const;
export type RgaFieldKey = (typeof RGA_FIELD_KEYS)[number];

/** Motivos de "não reconheci este arquivo" (traduzidos pelo app; também vão ao Sentry, sem valores). */
export const RGA_FAILURE_REASONS = [
  'not_a_pdf',
  'too_large',
  'multiple_pages',
  'unexpected_page_size',
  'unreadable',
  'missing_required_fields',
  'qr_not_found',
] as const;
export type RgaFailureReason = (typeof RGA_FAILURE_REASONS)[number];

export const RGA_WARNING_CODES = [
  'rga_format', // RGA fora do formato XXX.XXXX.X-UF (só aviso)
  'microchip_confirm', // veio um valor diferente de "Não": provavelmente o número; confirmar
  'qr_mismatch', // QR e texto têm RGAs diferentes: arquivo pode ter sido alterado
  'qr_missing', // o PDF não trouxe o QR esperado
  'qr_unexpected', // havia um QR, mas não é do SinPatinhas
  'creator_unexpected', // metadado "Creator" diferente do esperado (possível mudança de modelo)
  'date_invalid', // data ilegível ou fora da ordem nascimento ≤ emissão ≤ hoje
  'phone_invalid', // telefone sem 10 ou 11 dígitos
  'place_invalid', // "Cidade - UF" ilegível
  'value_unrecognized', // valor fora do conjunto esperado (ex.: espécie)
  'ignored_items', // itens de texto fora das posições conhecidas
] as const;
export type RgaWarningCode = (typeof RGA_WARNING_CODES)[number];

const isoDate = z.string().refine(isValidIsoDate);
const place = z.object({ cidade: z.string().optional(), uf: z.enum(BR_UF).optional() });

export const rgaImportFieldsSchema = z.object({
  name: z.string().optional(),
  /** RGA já em maiúsculas. */
  rga: z.string().optional(),
  /** Número do microchip (só quando o documento traz um valor diferente de "Não"). */
  microchip: z.string().optional(),
  /** false = o documento diz "Não" (sem microchip). */
  hasMicrochip: z.boolean().optional(),
  neutered: z.enum(['yes', 'no']).optional(),
  species: z.enum(['dog', 'cat']).optional(),
  sex: z.enum(['male', 'female']).optional(),
  birthDate: isoDate.optional(),
  cor: z.string().optional(),
  naturalidade: place.optional(),
  /** Local de emissão. */
  issuedPlace: place.optional(),
  issuedOn: isoDate.optional(),
  /** Só é salvo no pet se a pessoa confirmar. */
  tutor: z
    .object({
      nome: z.string().optional(),
      telefone: z
        .string()
        .regex(/^\d{10,11}$/)
        .optional(),
    })
    .optional(),
});
export type RgaImportFields = z.infer<typeof rgaImportFieldsSchema>;

export const rgaImportResultSchema = z.object({
  /** "pdf" = carteira lida; "qr" = só o QR de uma imagem foi lido (o resto é manual). */
  mode: z.enum(['pdf', 'qr']),
  recognized: z.boolean(),
  reason: z.enum(RGA_FAILURE_REASONS).optional(),
  /** Texto do metadado "Creator" do PDF (identifica o gerador do documento, sem dado pessoal). */
  creator: z.string().optional(),
  fields: rgaImportFieldsSchema,
  /** Campos marcados "confira". */
  confirm: z.array(z.enum(RGA_FIELD_KEYS)),
  warnings: z.array(z.enum(RGA_WARNING_CODES)),
  qr: z.object({
    found: z.boolean(),
    rga: z.string().optional(),
    /** O RGA do QR é igual ao do texto? (indefinido sem os dois) */
    matches: z.boolean().optional(),
  }),
  /** Foto do animal na carteira, já em JPEG (base64). */
  photoJpegBase64: z.string().optional(),
});
export type RgaImportResult = z.infer<typeof rgaImportResultSchema>;
