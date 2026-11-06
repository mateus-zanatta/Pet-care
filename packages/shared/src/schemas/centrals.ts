import { z } from 'zod';
import {
  ADOPTION_SPECIES,
  ADOPTION_STATUS,
  AGE_GROUP,
  ANIMAL_SIZE,
  BR_UF,
  REPORT_STATUS,
  REPORT_TYPE,
  RESCUE_ALERT_STATUS,
  RESCUE_ANIMAL_KIND,
  RESCUE_CONDITION,
  type RescueAnimalKind,
  SEX,
  TRISTATE,
  WILD_RESCUE_KINDS,
} from '../enums';
import { isAfterIso, isValidIsoDate, todayIso } from '../dates';
import { snapToGrid } from '../geo';

/**
 * Centrais de ADOÇÃO, RESGATE e DENÚNCIA. Tudo é criado e alterado por Cloud Functions (com limite diário por
 * pessoa); o app só lê. Os textos guardados são os que a pessoa digitou; os tipos são chaves (funcionam em qualquer idioma).
 */

export const MAX_CENTRAL_PHOTOS = 5;
/** Limites diários por pessoa (contra spam e abuso). */
export const DAILY_LIMITS = { adoption: 5, rescue: 10, report: 5 } as const;
export type CentralKind = keyof typeof DAILY_LIMITS;

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const PHONE = /^[\d\s()+-]{8,20}$/;
const text = (min: number, max: number) => z.string().trim().min(min, { message: min > 1 ? 'validation.tooShort' : 'validation.required' }).max(max, { message: 'validation.tooLong' });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: 'validation.tooLong' })
    .optional()
    .transform((v) => (v ? v : undefined));
const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || PHONE.test(v), { message: 'validation.phoneInvalid' });
const isoDate = z.string().refine(isValidIsoDate, { message: 'validation.dateInvalid' });
/** Foto já enviada ao Storage; o servidor confere que o caminho é do próprio registro. */
const photoPaths = z.array(z.string().min(1).max(200)).max(MAX_CENTRAL_PHOTOS);

/* ---------------------------------- Adoção ---------------------------------- */

/** Vacina, remédio ou exame já feito (texto livre: o app nunca sugere nada). */
export const healthItemSchema = z.object({
  name: text(1, 80),
  date: isoDate.optional(),
  note: optionalText(200),
});
export type HealthItem = z.infer<typeof healthItemSchema>;

/**
 * PRIVACIDADE: o anúncio mostra só cidade/UF. A coordenada (para "perto de mim") vai arredondada na grade (~1 km)
 * e é arredondada de novo no servidor. O endereço de quem doa nunca é pedido.
 */
export const adoptionInputSchema = z.object({
  species: z.enum(ADOPTION_SPECIES),
  name: optionalText(60),
  sex: z.enum(SEX),
  ageGroup: z.enum(AGE_GROUP),
  breed: optionalText(60),
  colors: z.array(text(1, 30)).min(1, { message: 'validation.required' }).max(5),
  size: z.enum(ANIMAL_SIZE).optional(),
  neutered: z.enum(TRISTATE),
  vaccines: z.array(healthItemSchema).max(20),
  medications: z.array(healthItemSchema).max(20),
  exams: z.array(healthItemSchema).max(20),
  healthNotes: optionalText(1000),
  description: text(10, 2000),
  city: text(1, 80),
  uf: z.enum(BR_UF),
  lat: lat.optional(),
  lng: lng.optional(),
  /** Telefone/WhatsApp de contato. Só pessoas com cadastro veem. */
  contactPhone: phone.refine((v) => v !== undefined, { message: 'validation.required' }),
});
export type AdoptionInput = z.infer<typeof adoptionInputSchema>;

export const adoptionUpdateSchema = z.object({
  id: z.string().min(1).max(128),
  data: adoptionInputSchema.partial().optional(),
  status: z.enum(ADOPTION_STATUS).optional(),
  photoPaths: photoPaths.optional(),
});

/** Documento salvo em `adoption_listings/{id}`. */
export type AdoptionListing = AdoptionInput & {
  id: string;
  ownerId: string;
  ownerName?: string;
  status: (typeof ADOPTION_STATUS)[number];
  photoPaths: string[];
  createdAtMs: number;
};

/** Coordenada que pode ser guardada num anúncio de adoção: sempre a célula (~1 km), nunca o ponto exato. */
export function adoptionPoint(input: { lat?: number; lng?: number }): { lat: number; lng: number } | undefined {
  if (input.lat === undefined || input.lng === undefined) return undefined;
  return snapToGrid({ lat: input.lat, lng: input.lng });
}

/* ---------------------------------- Resgate ---------------------------------- */

/**
 * Alerta de resgate: um LOCAL onde há um animal precisando de ajuda, para ONGs, órgãos ambientais e voluntários
 * irem até lá. Aqui o ponto é EXATO (sem ele ninguém encontra o animal) e só pessoas com cadastro veem.
 */
export const rescueAlertInputSchema = z.object({
  animalKind: z.enum(RESCUE_ANIMAL_KIND),
  conditions: z.array(z.enum(RESCUE_CONDITION)).min(1, { message: 'validation.required' }).max(RESCUE_CONDITION.length),
  count: z.number().int().min(1).max(50),
  description: text(10, 1500),
  lat,
  lng,
  address: optionalText(200),
  reference: optionalText(200),
  contactPhone: phone,
});
export type RescueAlertInput = z.infer<typeof rescueAlertInputSchema>;

export const rescueAlertUpdateSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum(RESCUE_ALERT_STATUS).optional(),
  photoPaths: photoPaths.optional(),
});

export type RescueAlert = RescueAlertInput & {
  id: string;
  reporterId: string;
  status: (typeof RESCUE_ALERT_STATUS)[number];
  photoPaths: string[];
  createdAtMs: number;
};

export function isWildRescue(kind: RescueAnimalKind): boolean {
  return WILD_RESCUE_KINDS.includes(kind);
}

/** Quem deve ser chamado primeiro, conforme o animal (o app mostra os contatos certos). */
export function rescueAuthority(kind: RescueAnimalKind): 'environmental' | 'livestock' | 'domestic' {
  if (isWildRescue(kind)) return 'environmental';
  if (kind === 'horse' || kind === 'livestock') return 'livestock';
  return 'domestic';
}

/* --------------------------------- Denúncia --------------------------------- */

/**
 * Denúncia de maus-tratos. É PRIVADA: só quem denunciou vê (e, no futuro, a equipe de moderação, no painel).
 * "anonymous" = a identidade de quem denunciou não é repassada a quem receber o encaminhamento.
 */
export const reportInputSchema = z
  .object({
    type: z.enum(REPORT_TYPE),
    description: text(20, 3000),
    /** Campo de data vazio chega como '' do formulário: vira "não informado". */
    occurredOn: z
      .union([z.literal(''), isoDate])
      .optional()
      .transform((v) => (v ? v : undefined)),
    ongoing: z.boolean(),
    animalKind: z.enum(RESCUE_ANIMAL_KIND).optional(),
    animalCount: z.number().int().min(1).max(500).optional(),
    lat,
    lng,
    address: optionalText(200),
    reference: optionalText(200),
    suspectInfo: optionalText(500),
    anonymous: z.boolean(),
  })
  .refine((r) => !r.occurredOn || !isAfterIso(r.occurredOn, todayIso()), {
    message: 'validation.dateFuture',
    path: ['occurredOn'],
  });
export type ReportInput = z.infer<typeof reportInputSchema>;

export const reportPhotosSchema = z.object({ id: z.string().min(1).max(128), photoPaths });

export type AnimalReport = ReportInput & {
  id: string;
  reporterId: string;
  status: (typeof REPORT_STATUS)[number];
  photoPaths: string[];
  createdAtMs: number;
};

/** Pastas do Storage de cada central (o servidor só aceita fotos dentro da pasta do próprio registro). */
export const CENTRAL_STORAGE_ROOT = { adoption: 'adoptions', rescue: 'rescues', report: 'reports' } as const;

export function isOwnPhotoPath(kind: CentralKind, id: string, path: string): boolean {
  const prefix = `${CENTRAL_STORAGE_ROOT[kind]}/${id}/`;
  return path.startsWith(prefix) && /^[\w-]+\.jpg$/.test(path.slice(prefix.length));
}
