import {
  HEALTH_EVENT_FORM_OPTIONAL_KEYS,
  type HealthEvent,
  type HealthEventData,
  VACCINE_FORM_OPTIONAL_KEYS,
  type Vaccine,
  type VaccineData,
  healthEventDocSchema,
  vaccineDocSchema,
} from '@petcare/shared';

/** Lê documentos do Firestore; documentos corrompidos viram null (e são ignorados). */
export function parseVaccine(id: string, data: unknown): Vaccine | null {
  const parsed = vaccineDocSchema.safeParse(data);
  return parsed.success ? { id, ...parsed.data } : null;
}

export function parseHealthEvent(id: string, data: unknown): HealthEvent | null {
  const parsed = healthEventDocSchema.safeParse(data);
  return parsed.success ? { id, ...parsed.data } : null;
}

/**
 * Atualização de uma vacina: campos opcionais apagados no formulário viram `removeMarker` (deleteField).
 * Não toca em anexos nem em autoria/criação.
 */
export function buildVaccineUpdate<M>(data: VaccineData, removeMarker: M): Record<string, unknown> {
  const update: Record<string, unknown> = { name: data.name, appliedOn: data.appliedOn };
  for (const key of VACCINE_FORM_OPTIONAL_KEYS) update[key] = data[key] ?? removeMarker;
  return update;
}

export function buildHealthEventUpdate<M>(data: HealthEventData, removeMarker: M): Record<string, unknown> {
  const update: Record<string, unknown> = { type: data.type, date: data.date, title: data.title };
  for (const key of HEALTH_EVENT_FORM_OPTIONAL_KEYS) update[key] = data[key] ?? removeMarker;
  return update;
}
