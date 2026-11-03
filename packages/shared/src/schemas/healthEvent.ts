import { z } from 'zod';
import { HEALTH_EVENT_TYPE } from '../enums';
import { isAfterIso, isValidIsoDate, todayIso } from '../dates';
import { attachmentRefSchema, MAX_ATTACHMENTS } from './attachment';
import { type VetFormValues, validateVetFields, vetFromForm, vetSchema, vetToForm } from './vet';

const required = { message: 'validation.required' };
const tooLong = { message: 'validation.tooLong' };

/* ----------------------------- Formulário (strings) ----------------------------- */

export const healthEventFormSchema = z
  .object({
    type: z.enum(HEALTH_EVENT_TYPE),
    date: z.string(),
    title: z.string().trim().min(1, required).max(80, tooLong),
    description: z.string().trim().max(1000, tooLong),
    /** Próxima aplicação/retorno (ex.: próximo vermífugo). Opcional. */
    nextDate: z.string(),
    vetName: z.string().trim().max(80, tooLong),
    crmvNumber: z.string().trim().max(10, tooLong),
    crmvUf: z.string().trim(),
    clinic: z.string().trim().max(120, tooLong),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    if (v.date === '') issue('date', 'validation.required');
    else if (!isValidIsoDate(v.date)) issue('date', 'validation.dateInvalid');
    else if (isAfterIso(v.date, todayIso())) issue('date', 'validation.dateFuture');

    if (v.nextDate !== '') {
      if (!isValidIsoDate(v.nextDate)) issue('nextDate', 'validation.dateInvalid');
      else if (isValidIsoDate(v.date) && !isAfterIso(v.nextDate, v.date)) issue('nextDate', 'validation.nextBeforeDate');
    }
    validateVetFields(v, issue);
  });
export type HealthEventFormValues = z.infer<typeof healthEventFormSchema>;

export const HEALTH_EVENT_FORM_DEFAULTS: HealthEventFormValues = {
  type: 'consultation',
  date: '',
  title: '',
  description: '',
  nextDate: '',
  vetName: '',
  crmvNumber: '',
  crmvUf: '',
  clinic: '',
};

/* ----------------------------- Dados no Firestore ----------------------------- */

const isoDate = z.string().refine(isValidIsoDate, { message: 'invalid ISO date' });

export const healthEventDataSchema = z.object({
  type: z.enum(HEALTH_EVENT_TYPE),
  date: isoDate,
  title: z.string().trim().min(1).max(80),
  description: z.string().max(1000).optional(),
  nextDate: isoDate.optional(),
  vet: vetSchema.optional(),
  clinic: z.string().max(120).optional(),
});
export type HealthEventData = z.infer<typeof healthEventDataSchema>;

export const HEALTH_EVENT_FORM_OPTIONAL_KEYS = ['description', 'nextDate', 'vet', 'clinic'] as const satisfies readonly (keyof HealthEventData)[];

export const healthEventDocSchema = healthEventDataSchema.extend({
  attachments: z.array(attachmentRefSchema).max(MAX_ATTACHMENTS).optional(),
  createdBy: z.string().min(1),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
});
export type HealthEventDoc = z.infer<typeof healthEventDocSchema>;
export type HealthEvent = HealthEventDoc & { id: string };

export function healthEventFormToData(v: HealthEventFormValues): HealthEventData {
  const data: HealthEventData = { type: v.type, date: v.date, title: v.title.trim() };
  if (v.description.trim()) data.description = v.description.trim();
  if (v.nextDate) data.nextDate = v.nextDate;
  const vet = vetFromForm(v as VetFormValues);
  if (vet) data.vet = vet;
  if (v.clinic.trim()) data.clinic = v.clinic.trim();
  return data;
}

export function healthEventToFormValues(d: HealthEventData): HealthEventFormValues {
  return {
    type: d.type,
    date: d.date,
    title: d.title,
    description: d.description ?? '',
    nextDate: d.nextDate ?? '',
    ...vetToForm(d.vet),
    clinic: d.clinic ?? '',
  };
}
