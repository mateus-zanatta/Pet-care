import {
  type DoseLog,
  type Medication,
  type MedicationData,
  MEDICATION_FORM_OPTIONAL_KEYS,
  doseLogDataSchema,
  medicationDocSchema,
} from '@petcare/shared';

/** Lê um documento do Firestore como Medication; documentos corrompidos viram null (e são ignorados). */
export function parseMedication(id: string, data: unknown): Medication | null {
  const parsed = medicationDocSchema.safeParse(data);
  return parsed.success ? { id, ...parsed.data } : null;
}

export function parseDoseLog(id: string, data: unknown): DoseLog | null {
  const parsed = doseLogDataSchema.safeParse(data);
  return parsed.success ? { id, ...parsed.data } : null;
}

/**
 * Monta a atualização de um medicamento. Campos opcionais que a pessoa apagou viram `removeMarker`
 * (deleteField do Firestore) em vez de ficarem para trás. Não toca em createdBy/createdAt.
 */
export function buildMedicationUpdate<M>(data: MedicationData, removeMarker: M): Record<string, unknown> {
  const update: Record<string, unknown> = {
    name: data.name,
    dose: data.dose,
    frequency: data.frequency,
    startDate: data.startDate,
    status: data.status,
  };
  for (const key of MEDICATION_FORM_OPTIONAL_KEYS) {
    update[key] = data[key] ?? removeMarker;
  }
  return update;
}

/** Ordem da lista: em uso primeiro; dentro de cada grupo, por nome. */
export function sortMedications<T extends { status: string; name: string }>(items: readonly T[]): T[] {
  const rank = (status: string) => (status === 'active' ? 0 : status === 'suspended' ? 1 : 2);
  return [...items].sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name));
}
