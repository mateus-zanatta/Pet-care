import type { PetFormValues } from '@petcare/shared';
import type { FormFieldName } from './rga.mapper';

export type FieldChange = { field: FormFieldName; before: string; after: string };

/**
 * O que mudaria num pet já cadastrado se os dados do RG fossem aplicados.
 * Só compara os campos que o RG preencheu (`filled`); o resto do cadastro não é tocado.
 */
export function diffFormValues(
  before: PetFormValues,
  after: PetFormValues,
  filled: readonly FormFieldName[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of new Set(filled)) {
    if (before[field] !== after[field]) {
      changes.push({ field, before: String(before[field]), after: String(after[field]) });
    }
  }
  return changes;
}

/** Agrupa cidade e UF numa linha só para exibição ("Campinas - SP"). */
export function mergePlaceChanges(changes: readonly FieldChange[]): FieldChange[] {
  const city = changes.find((c) => c.field === 'naturalCity');
  const uf = changes.find((c) => c.field === 'naturalUf');
  if (!city && !uf) return [...changes];
  const rest = changes.filter((c) => c.field !== 'naturalCity' && c.field !== 'naturalUf');
  const join = (a?: string, b?: string) => [a, b].filter(Boolean).join(' - ');
  return [
    ...rest,
    {
      field: 'naturalCity',
      before: join(city?.before, uf?.before),
      after: join(city?.after, uf?.after),
    },
  ];
}
