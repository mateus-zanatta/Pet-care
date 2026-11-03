/**
 * Enums internos. SEMPRE salvamos estas chaves (nunca texto em português),
 * para o app funcionar em qualquer idioma.
 */

export const SPECIES = ['dog', 'cat', 'bird', 'rabbit', 'rodent', 'reptile', 'other'] as const;
export type Species = (typeof SPECIES)[number];

export const SEX = ['male', 'female', 'unknown'] as const;
export type Sex = (typeof SEX)[number];

export const TRISTATE = ['yes', 'no', 'unknown'] as const;
export type TriState = (typeof TRISTATE)[number];

export const PET_ORIGIN = ['manual', 'rescue', 'rga_import'] as const;
export type PetOrigin = (typeof PET_ORIGIN)[number];

export const RESCUE_STATUS = ['in_treatment', 'foster', 'adoptable', 'adopted'] as const;
export type RescueStatus = (typeof RESCUE_STATUS)[number];

export const MEMBER_ROLE = ['owner', 'caregiver', 'viewer'] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

export const SINPATINHAS_SOURCE = ['pdf', 'qr', 'manual'] as const;
export type SinpatinhasSource = (typeof SINPATINHAS_SOURCE)[number];

export const BR_UF = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export type BrUf = (typeof BR_UF)[number];

export const LOCALES = ['pt-BR', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];

/** Versão dos textos legais aceitos pelo usuário (muda quando os textos mudam). */
export const LEGAL_VERSION = '2026-11-03';
