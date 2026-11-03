import {
  PET_FORM_DEFAULTS,
  type PetFormValues,
  type RgaFieldKey,
  type RgaImportResult,
  type RgaWarningCode,
  type SinpatinhasMeta,
} from '@petcare/shared';

export type FieldBadge = 'rga' | 'check';
export type FormFieldName = keyof PetFormValues;

export type RgaPrefill = {
  /** Valores do formulário: os de `base` + o que o RG preencheu. */
  values: PetFormValues;
  /** Selos por campo: "lido do RG" ou "confira" ("confira" vence). */
  badges: Partial<Record<FormFieldName, FieldBadge>>;
  /** Campos que o RG preencheu (usados para comparar com um pet existente). */
  filled: FormFieldName[];
  /** Nome/telefone do responsável: só são salvos se a pessoa confirmar. */
  tutor?: { nome?: string; telefone?: string };
  sinpatinhas: SinpatinhasMeta;
  warnings: RgaWarningCode[];
};

/** Campo do formulário que corresponde a cada campo do RG (alguns não têm campo no formulário). */
const CONFIRM_TO_FORM: Partial<Record<RgaFieldKey, FormFieldName[]>> = {
  name: ['name'],
  rga: ['rga'],
  microchip: ['microchip'],
  neutered: ['neutered'],
  species: ['species'],
  birthDate: ['birthDate'],
  cor: ['cor'],
  sex: ['sex'],
  naturalidade: ['naturalCity', 'naturalUf'],
};

/**
 * Converte o que a função leu em valores para o formulário do pet. NADA é salvo aqui: a pessoa
 * revisa e só então confirma. Os enums já chegam internos (dog, female, yes...).
 */
export function rgaResultToPrefill(
  result: RgaImportResult,
  nowIso: string,
  base: PetFormValues = PET_FORM_DEFAULTS,
): RgaPrefill {
  const { fields } = result;
  const values: PetFormValues = { ...base };
  const filled: FormFieldName[] = [];
  const badges: Partial<Record<FormFieldName, FieldBadge>> = {};

  const set = <K extends FormFieldName>(key: K, value: PetFormValues[K]) => {
    values[key] = value;
    filled.push(key);
    badges[key] = 'rga';
  };

  if (fields.name) set('name', fields.name);
  if (fields.rga) set('rga', fields.rga);
  if (fields.species) set('species', fields.species);
  if (fields.sex) set('sex', fields.sex);
  if (fields.neutered) set('neutered', fields.neutered);
  if (fields.cor) set('cor', fields.cor);
  if (fields.microchip) set('microchip', fields.microchip);
  if (fields.birthDate) {
    values.birthMode = 'date';
    set('birthDate', fields.birthDate);
  }
  if (fields.naturalidade?.cidade) set('naturalCity', fields.naturalidade.cidade);
  if (fields.naturalidade?.uf) set('naturalUf', fields.naturalidade.uf);

  // "confira" vence "lido do RG" — e vale também para o que foi descartado (ex.: data inválida).
  for (const key of result.confirm) {
    for (const field of CONFIRM_TO_FORM[key] ?? []) badges[field] = 'check';
  }
  // Data de nascimento descartada: mostra o campo (vazio, com "confira") se a pessoa ainda não informou nada.
  if (badges.birthDate === 'check' && !fields.birthDate && values.birthMode === 'unknown') {
    values.birthMode = 'date';
  }

  return {
    values,
    badges,
    filled,
    ...(fields.tutor && (fields.tutor.nome || fields.tutor.telefone) ? { tutor: fields.tutor } : {}),
    sinpatinhas: {
      ...(fields.issuedOn ? { emitidoEm: fields.issuedOn } : {}),
      importadoEm: nowIso,
      origem: result.mode === 'pdf' ? 'pdf' : 'qr',
      ...(result.qr.matches !== undefined ? { qrConfere: result.qr.matches } : {}),
    },
    warnings: result.warnings,
  };
}
