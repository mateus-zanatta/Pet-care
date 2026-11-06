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

/* ----------------------------- Medicamentos (Fase 2) ----------------------------- */

/** Via de administração, como prescrita pelo veterinário (o app nunca sugere). */
export const MEDICATION_ROUTE = ['oral', 'topical', 'injectable', 'ophthalmic', 'otic', 'other'] as const;
export type MedicationRoute = (typeof MEDICATION_ROUTE)[number];

export const MEDICATION_STATUS = ['active', 'completed', 'suspended'] as const;
export type MedicationStatus = (typeof MEDICATION_STATUS)[number];

/** Onde o medicamento é aplicado. Favoritos do "Perto de mim" entram na Fase 3. */
export const MEDICATION_PLACE = ['home', 'clinic', 'address'] as const;
export type MedicationPlace = (typeof MEDICATION_PLACE)[number];

export const FREQUENCY_KIND = ['interval', 'fixed'] as const;
export type FrequencyKind = (typeof FREQUENCY_KIND)[number];

export const DOSE_OUTCOME = ['given', 'skipped'] as const;
export type DoseOutcome = (typeof DOSE_OUTCOME)[number];

/* ------------------------- Saúde: vacinas e eventos (Fase 2B) ------------------------- */

/** Tipos da linha do tempo de saúde (vacinas têm coleção própria). */
export const HEALTH_EVENT_TYPE = ['consultation', 'deworming', 'flea_tick', 'exam', 'surgery', 'other'] as const;
export type HealthEventType = (typeof HEALTH_EVENT_TYPE)[number];

/* ------------------------------ Perto de mim (Fase 3) ------------------------------ */

/** Tipos de local. Emergência/24 h é uma marca do local (não um tipo), porque uma clínica pode ser 24 h. */
export const PLACE_CATEGORY = ['vet', 'petshop', 'shelter'] as const;
export type PlaceCategory = (typeof PLACE_CATEGORY)[number];

/** De onde veio o local: OpenStreetMap (grátis) agora; Google Places pode entrar depois. */
export const PLACE_SOURCE = ['osm', 'google'] as const;
export type PlaceSource = (typeof PLACE_SOURCE)[number];

/* ------------------------- Centrais: adoção, resgate e denúncia ------------------------- */

/** Espécies aceitas na adoção (inclui cavalo: há muita adoção de equinos resgatados). */
export const ADOPTION_SPECIES = ['dog', 'cat', 'bird', 'rabbit', 'rodent', 'reptile', 'horse', 'other'] as const;
export type AdoptionSpecies = (typeof ADOPTION_SPECIES)[number];

/** Faixa de idade: quem doa raramente sabe a data exata. */
export const AGE_GROUP = ['baby', 'young', 'adult', 'senior'] as const;
export type AgeGroup = (typeof AGE_GROUP)[number];

export const ANIMAL_SIZE = ['small', 'medium', 'large'] as const;
export type AnimalSize = (typeof ANIMAL_SIZE)[number];

export const ADOPTION_STATUS = ['available', 'reserved', 'adopted'] as const;
export type AdoptionStatus = (typeof ADOPTION_STATUS)[number];

/** Qualquer animal pode precisar de resgate, não só pets: silvestres, cavalos, gado, marinhos... */
export const RESCUE_ANIMAL_KIND = [
  'dog',
  'cat',
  'horse',
  'livestock',
  'wild_bird',
  'wild_mammal',
  'reptile',
  'marine',
  'other',
] as const;
export type RescueAnimalKind = (typeof RESCUE_ANIMAL_KIND)[number];

/** Silvestres e marinhos: quem resgata é o órgão ambiental (manusear por conta própria é perigoso e pode ser crime). */
export const WILD_RESCUE_KINDS: readonly RescueAnimalKind[] = ['wild_bird', 'wild_mammal', 'reptile', 'marine'];

export const RESCUE_CONDITION = ['injured', 'trapped', 'sick', 'abandoned', 'at_risk'] as const;
export type RescueCondition = (typeof RESCUE_CONDITION)[number];

export const RESCUE_ALERT_STATUS = ['open', 'in_progress', 'rescued', 'closed'] as const;
export type RescueAlertStatus = (typeof RESCUE_ALERT_STATUS)[number];

/** Tipos de denúncia (Lei 9.605/98, art. 32: maus-tratos a qualquer animal é crime). */
export const REPORT_TYPE = [
  'abandonment',
  'physical_abuse',
  'neglect',
  'confinement',
  'poisoning',
  'animal_fighting',
  'wildlife_trafficking',
  'sexual_abuse',
  'other',
] as const;
export type ReportType = (typeof REPORT_TYPE)[number];

export const REPORT_STATUS = ['received', 'forwarded', 'closed'] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];
