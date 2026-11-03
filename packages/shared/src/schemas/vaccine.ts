import { z } from 'zod';
import { isAfterIso, isValidIsoDate, todayIso } from '../dates';
import { attachmentRefSchema, MAX_ATTACHMENTS } from './attachment';
import { type VetFormValues, validateVetFields, vetFromForm, vetSchema, vetToForm } from './vet';

const required = { message: 'validation.required' };
const tooLong = { message: 'validation.tooLong' };

/* ----------------------------- Formulário (strings) ----------------------------- */

export const vaccineFormSchema = z
  .object({
    name: z.string().trim().min(1, required).max(80, tooLong),
    /** ISO, vazio ou qualquer outro texto (= data inválida digitada). */
    appliedOn: z.string(),
    nextDoseOn: z.string(),
    batch: z.string().trim().max(40, tooLong),
    vetName: z.string().trim().max(80, tooLong),
    crmvNumber: z.string().trim().max(10, tooLong),
    crmvUf: z.string().trim(),
    clinic: z.string().trim().max(120, tooLong),
    notes: z.string().trim().max(1000, tooLong),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    if (v.appliedOn === '') issue('appliedOn', 'validation.required');
    else if (!isValidIsoDate(v.appliedOn)) issue('appliedOn', 'validation.dateInvalid');
    else if (isAfterIso(v.appliedOn, todayIso())) issue('appliedOn', 'validation.dateFuture');

    if (v.nextDoseOn !== '') {
      if (!isValidIsoDate(v.nextDoseOn)) issue('nextDoseOn', 'validation.dateInvalid');
      else if (isValidIsoDate(v.appliedOn) && !isAfterIso(v.nextDoseOn, v.appliedOn)) {
        issue('nextDoseOn', 'validation.nextBeforeDate');
      }
    }
    validateVetFields(v, issue);
  });
export type VaccineFormValues = z.infer<typeof vaccineFormSchema>;

export const VACCINE_FORM_DEFAULTS: VaccineFormValues = {
  name: '',
  appliedOn: '',
  nextDoseOn: '',
  batch: '',
  vetName: '',
  crmvNumber: '',
  crmvUf: '',
  clinic: '',
  notes: '',
};

/* ----------------------------- Dados no Firestore ----------------------------- */

const isoDate = z.string().refine(isValidIsoDate, { message: 'invalid ISO date' });

export const vaccineDataSchema = z.object({
  name: z.string().trim().min(1).max(80),
  appliedOn: isoDate,
  nextDoseOn: isoDate.optional(),
  batch: z.string().max(40).optional(),
  vet: vetSchema.optional(),
  clinic: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});
export type VaccineData = z.infer<typeof vaccineDataSchema>;

/** Campos opcionais que o formulário controla (os anexos têm tela própria e não entram aqui). */
export const VACCINE_FORM_OPTIONAL_KEYS = ['nextDoseOn', 'batch', 'vet', 'clinic', 'notes'] as const satisfies readonly (keyof VaccineData)[];

export const vaccineDocSchema = vaccineDataSchema.extend({
  attachments: z.array(attachmentRefSchema).max(MAX_ATTACHMENTS).optional(),
  createdBy: z.string().min(1),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
});
export type VaccineDoc = z.infer<typeof vaccineDocSchema>;
export type Vaccine = VaccineDoc & { id: string };

export function vaccineFormToData(v: VaccineFormValues): VaccineData {
  const data: VaccineData = { name: v.name.trim(), appliedOn: v.appliedOn };
  if (v.nextDoseOn) data.nextDoseOn = v.nextDoseOn;
  if (v.batch.trim()) data.batch = v.batch.trim();
  const vet = vetFromForm(v as VetFormValues);
  if (vet) data.vet = vet;
  if (v.clinic.trim()) data.clinic = v.clinic.trim();
  if (v.notes.trim()) data.notes = v.notes.trim();
  return data;
}

export function vaccineToFormValues(d: VaccineData): VaccineFormValues {
  return {
    name: d.name,
    appliedOn: d.appliedOn,
    nextDoseOn: d.nextDoseOn ?? '',
    batch: d.batch ?? '',
    ...vetToForm(d.vet),
    clinic: d.clinic ?? '',
    notes: d.notes ?? '',
  };
}
