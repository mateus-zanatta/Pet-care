import { z } from 'zod';
import {
  BR_UF,
  type BrUf,
  PET_ORIGIN,
  RESCUE_STATUS,
  SEX,
  SINPATINHAS_SOURCE,
  SPECIES,
  TRISTATE,
} from '../enums';
import { isAfterIso, isValidIsoDate, monthsBetween, todayIso } from '../dates';

/* -------------------------------------------------------------------------- */
/*  Parsers pequenos (aceitam vírgula decimal: "12,5")                         */
/* -------------------------------------------------------------------------- */

/** "12,5" | "12.5" -> 12.5. Retorna null se vazio ou inválido. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseDigits(input: string): number | null {
  const t = input.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** Remove espaços/hífens do microchip. */
export function normalizeMicrochip(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isBrUf(value: string): value is BrUf {
  return (BR_UF as readonly string[]).includes(value);
}

const MICROCHIP_REGEX = /^[A-Z0-9]{9,15}$/;
export const MAX_APPROX_AGE_MONTHS = 360;
export const MAX_WEIGHT_KG = 200;

/* -------------------------------------------------------------------------- */
/*  Formulário (tudo string, como vem dos campos de texto)                     */
/* -------------------------------------------------------------------------- */

export const BIRTH_MODES = ['date', 'age', 'unknown'] as const;
export type BirthMode = (typeof BIRTH_MODES)[number];

const required = { message: 'validation.required' };
const tooLong = { message: 'validation.tooLong' };

export const petFormSchema = z
  .object({
    name: z.string().trim().min(1, required).max(60, tooLong),
    species: z.enum(SPECIES, required),
    breed: z.string().trim().max(60, tooLong),
    sex: z.enum(SEX),
    neutered: z.enum(TRISTATE),
    birthMode: z.enum(BIRTH_MODES),
    /** ISO `YYYY-MM-DD`, vazio, ou qualquer outro texto (= data inválida digitada). */
    birthDate: z.string(),
    ageYears: z.string().trim(),
    ageMonths: z.string().trim(),
    weight: z.string().trim(),
    microchip: z.string().trim().max(30, tooLong),
    rga: z.string().trim().max(20, tooLong),
    cor: z.string().trim().max(40, tooLong),
    naturalCity: z.string().trim().max(80, tooLong),
    naturalUf: z
      .string()
      .trim()
      .refine((v): boolean => v === '' || isBrUf(v.toUpperCase()), {
        message: 'validation.ufInvalid',
      }),
    allergies: z.string().trim().max(500, tooLong),
    notes: z.string().trim().max(1000, tooLong),
    addressText: z.string().trim().max(200, tooLong),
  })
  .superRefine((v, ctx) => {
    if (v.birthMode === 'date') {
      if (v.birthDate === '') {
        ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'validation.required' });
      } else if (!isValidIsoDate(v.birthDate)) {
        ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'validation.dateInvalid' });
      } else if (isAfterIso(v.birthDate, todayIso())) {
        ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'validation.dateFuture' });
      }
    }

    if (v.birthMode === 'age') {
      const years = v.ageYears === '' ? 0 : parseDigits(v.ageYears);
      const months = v.ageMonths === '' ? 0 : parseDigits(v.ageMonths);
      if (years === null) {
        ctx.addIssue({ code: 'custom', path: ['ageYears'], message: 'validation.numberInvalid' });
      }
      if (months === null) {
        ctx.addIssue({ code: 'custom', path: ['ageMonths'], message: 'validation.numberInvalid' });
      }
      if (years !== null && months !== null) {
        if (v.ageYears === '' && v.ageMonths === '') {
          ctx.addIssue({ code: 'custom', path: ['ageYears'], message: 'validation.required' });
        } else if (years * 12 + months > MAX_APPROX_AGE_MONTHS) {
          ctx.addIssue({ code: 'custom', path: ['ageYears'], message: 'validation.ageTooHigh' });
        }
      }
    }

    if (v.weight !== '') {
      const w = parseDecimal(v.weight);
      if (w === null || w <= 0 || w > MAX_WEIGHT_KG) {
        ctx.addIssue({ code: 'custom', path: ['weight'], message: 'validation.weightInvalid' });
      }
    }

    if (v.microchip !== '' && !MICROCHIP_REGEX.test(normalizeMicrochip(v.microchip))) {
      ctx.addIssue({ code: 'custom', path: ['microchip'], message: 'validation.microchipInvalid' });
    }
  });

export type PetFormValues = z.infer<typeof petFormSchema>;

export const PET_FORM_DEFAULTS: PetFormValues = {
  name: '',
  species: 'dog',
  breed: '',
  sex: 'unknown',
  neutered: 'unknown',
  birthMode: 'unknown',
  birthDate: '',
  ageYears: '',
  ageMonths: '',
  weight: '',
  microchip: '',
  rga: '',
  cor: '',
  naturalCity: '',
  naturalUf: '',
  allergies: '',
  notes: '',
  addressText: '',
};

/* -------------------------------------------------------------------------- */
/*  Dados salvos no Firestore                                                  */
/* -------------------------------------------------------------------------- */

const isoDate = z.string().refine(isValidIsoDate, { message: 'invalid ISO date' });

export const sinpatinhasSchema = z.object({
  emitidoEm: isoDate.optional(),
  /** Instante da importação, em ISO 8601. */
  importadoEm: z.string(),
  origem: z.enum(SINPATINHAS_SOURCE),
  qrConfere: z.boolean().optional(),
});
export type SinpatinhasMeta = z.infer<typeof sinpatinhasSchema>;

/** Nome/telefone do responsável: só é salvo se a pessoa confirmar. CPF/CNPJ: nunca. */
export const tutorSchema = z.object({
  nome: z.string().trim().max(120).optional(),
  telefone: z
    .string()
    .regex(/^\d{10,11}$/)
    .optional(),
});

export const petDataSchema = z.object({
  name: z.string().trim().min(1).max(60),
  species: z.enum(SPECIES),
  breed: z.string().max(60).optional(),
  sex: z.enum(SEX),
  neutered: z.enum(TRISTATE),
  birthDate: isoDate.optional(),
  /** Idade aproximada informada em `recordedOn`; a idade atual soma o tempo decorrido. */
  approxAge: z
    .object({
      months: z.number().int().min(0).max(MAX_APPROX_AGE_MONTHS),
      recordedOn: isoDate,
    })
    .optional(),
  weightKg: z.number().positive().max(MAX_WEIGHT_KG).optional(),
  microchip: z.string().regex(MICROCHIP_REGEX).optional(),
  rga: z.string().max(20).optional(),
  cor: z.string().max(40).optional(),
  naturalidade: z
    .object({ cidade: z.string().max(80).optional(), uf: z.enum(BR_UF).optional() })
    .optional(),
  allergies: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  address: z.object({ text: z.string().max(200) }).optional(),
});
export type PetData = z.infer<typeof petDataSchema>;

/** Campos opcionais que o formulário controla (usados para limpar o que o usuário apagou). */
export const PET_FORM_OPTIONAL_KEYS = [
  'breed',
  'birthDate',
  'approxAge',
  'weightKg',
  'microchip',
  'rga',
  'cor',
  'naturalidade',
  'allergies',
  'notes',
  'address',
] as const satisfies readonly (keyof PetData)[];

/** Campos gerenciados pelo sistema (não vêm do formulário). */
export const petDocSchema = petDataSchema.extend({
  ownerId: z.string().min(1),
  origin: z.enum(PET_ORIGIN),
  rescueId: z.string().optional(),
  rescueStatus: z.enum(RESCUE_STATUS).optional(),
  photoPath: z.string().optional(),
  sinpatinhas: sinpatinhasSchema.optional(),
  tutor: tutorSchema.optional(),
  /** Timestamps do Firestore; convertidos na camada do app. */
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
  photoUpdatedAt: z.unknown().optional(),
});
export type PetDoc = z.infer<typeof petDocSchema>;
export type Pet = PetDoc & { id: string };

/* -------------------------------------------------------------------------- */
/*  Conversões formulário <-> dados                                            */
/* -------------------------------------------------------------------------- */

export function petFormToData(values: PetFormValues, today: string = todayIso()): PetData {
  const data: PetData = {
    name: values.name.trim(),
    species: values.species,
    sex: values.sex,
    neutered: values.neutered,
  };

  if (values.breed.trim()) data.breed = values.breed.trim();

  if (values.birthMode === 'date' && isValidIsoDate(values.birthDate)) {
    data.birthDate = values.birthDate;
  } else if (values.birthMode === 'age') {
    const years = parseDigits(values.ageYears) ?? 0;
    const months = parseDigits(values.ageMonths) ?? 0;
    data.approxAge = { months: years * 12 + months, recordedOn: today };
  }

  const weight = parseDecimal(values.weight);
  if (weight !== null) data.weightKg = weight;

  const chip = normalizeMicrochip(values.microchip);
  if (chip) data.microchip = chip;

  const rga = values.rga.trim().toUpperCase();
  if (rga) data.rga = rga;

  if (values.cor.trim()) data.cor = values.cor.trim();

  const city = values.naturalCity.trim();
  const uf = values.naturalUf.trim().toUpperCase();
  if (city || uf) {
    data.naturalidade = {};
    if (city) data.naturalidade.cidade = city;
    if (isBrUf(uf)) data.naturalidade.uf = uf;
  }

  if (values.allergies.trim()) data.allergies = values.allergies.trim();
  if (values.notes.trim()) data.notes = values.notes.trim();
  if (values.addressText.trim()) data.address = { text: values.addressText.trim() };

  return data;
}

export function petToFormValues(pet: PetData, today: string = todayIso()): PetFormValues {
  const base: PetFormValues = {
    ...PET_FORM_DEFAULTS,
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? '',
    sex: pet.sex,
    neutered: pet.neutered,
    weight: pet.weightKg === undefined ? '' : String(pet.weightKg).replace('.', ','),
    microchip: pet.microchip ?? '',
    rga: pet.rga ?? '',
    cor: pet.cor ?? '',
    naturalCity: pet.naturalidade?.cidade ?? '',
    naturalUf: pet.naturalidade?.uf ?? '',
    allergies: pet.allergies ?? '',
    notes: pet.notes ?? '',
    addressText: pet.address?.text ?? '',
  };

  if (pet.birthDate) {
    return { ...base, birthMode: 'date', birthDate: pet.birthDate };
  }
  const ageMonths = computePetAgeMonths(pet, today);
  if (pet.approxAge && ageMonths !== null) {
    return {
      ...base,
      birthMode: 'age',
      ageYears: String(Math.floor(ageMonths / 12)),
      ageMonths: String(ageMonths % 12),
    };
  }
  return base;
}

/** Idade atual em meses; null se não houver informação. */
export function computePetAgeMonths(
  pet: Pick<PetData, 'birthDate' | 'approxAge'>,
  today: string = todayIso(),
): number | null {
  if (pet.birthDate) return monthsBetween(pet.birthDate, today);
  if (pet.approxAge) {
    return pet.approxAge.months + monthsBetween(pet.approxAge.recordedOn, today);
  }
  return null;
}
