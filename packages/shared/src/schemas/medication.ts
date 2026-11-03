import { z } from 'zod';
import {
  BR_UF,
  FREQUENCY_KIND,
  MEDICATION_PLACE,
  MEDICATION_ROUTE,
  MEDICATION_STATUS,
} from '../enums';
import { isAfterIso, isValidIsoDate, isValidTime, todayIso } from '../dates';
import { attachmentRefSchema, MAX_ATTACHMENTS } from './attachment';
import { isBrUf } from './pet';

/**
 * REGRA DO PRODUTO: o app NUNCA sugere medicamento, dose ou diagnóstico.
 * Estes schemas só guardam o que o veterinário prescreveu, "exatamente como prescrito".
 */

export const MAX_INTERVAL_HOURS = 168; // 1 semana
export const MAX_FIXED_TIMES = 12;
export const DEFAULT_START_TIME = '08:00';

const required = { message: 'validation.required' };
const tooLong = { message: 'validation.tooLong' };

/* -------------------------------------------------------------------------- */
/*  Formulário (tudo string, como vem dos campos de texto)                     */
/* -------------------------------------------------------------------------- */

export const medicationFormSchema = z
  .object({
    name: z.string().trim().min(1, required).max(80, tooLong),
    barcode: z.string().trim().max(64, tooLong),
    batch: z.string().trim().max(40, tooLong),
    /** ISO, vazio ou qualquer outro texto (= data inválida digitada). */
    expiresOn: z.string(),
    doseAmount: z.string().trim().min(1, required).max(20, tooLong),
    doseUnit: z.string().trim().min(1, required).max(20, tooLong),
    route: z.enum(MEDICATION_ROUTE),
    frequencyKind: z.enum(FREQUENCY_KIND),
    everyHours: z.string().trim(),
    times: z.array(z.string()),
    startDate: z.string(),
    /** "HH:MM" do 1º horário (só na frequência "a cada X horas"). */
    startTime: z.string().trim(),
    continuous: z.boolean(),
    endDate: z.string(),
    prescribedOn: z.string(),
    vetName: z.string().trim().max(80, tooLong),
    crmvNumber: z.string().trim().max(10, tooLong),
    crmvUf: z.string().trim(),
    placeKind: z.enum(MEDICATION_PLACE),
    placeText: z.string().trim().max(200, tooLong),
    status: z.enum(MEDICATION_STATUS),
    notes: z.string().trim().max(1000, tooLong),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    // Datas
    if (v.expiresOn !== '' && !isValidIsoDate(v.expiresOn)) issue('expiresOn', 'validation.dateInvalid');
    if (v.prescribedOn !== '') {
      if (!isValidIsoDate(v.prescribedOn)) issue('prescribedOn', 'validation.dateInvalid');
      else if (isAfterIso(v.prescribedOn, todayIso())) issue('prescribedOn', 'validation.dateFuture');
    }
    if (v.startDate === '') issue('startDate', 'validation.required');
    else if (!isValidIsoDate(v.startDate)) issue('startDate', 'validation.dateInvalid');

    if (!v.continuous) {
      if (v.endDate === '') issue('endDate', 'validation.required');
      else if (!isValidIsoDate(v.endDate)) issue('endDate', 'validation.dateInvalid');
      else if (isValidIsoDate(v.startDate) && isAfterIso(v.startDate, v.endDate)) {
        issue('endDate', 'validation.endBeforeStart');
      }
    }

    // Frequência
    if (v.frequencyKind === 'interval') {
      const hours = /^\d+$/.test(v.everyHours) ? Number(v.everyHours) : NaN;
      if (v.everyHours === '') issue('everyHours', 'validation.required');
      else if (!(hours >= 1 && hours <= MAX_INTERVAL_HOURS)) issue('everyHours', 'validation.hoursInvalid');
      if (!isValidTime(v.startTime)) issue('startTime', 'validation.timeInvalid');
    } else {
      if (v.times.length === 0) issue('times', 'validation.timesRequired');
      else if (v.times.length > MAX_FIXED_TIMES) issue('times', 'validation.timesTooMany');
      else if (v.times.some((time) => !isValidTime(time))) issue('times', 'validation.timeInvalid');
      else if (new Set(v.times).size !== v.times.length) issue('times', 'validation.timesDuplicate');
    }

    // Veterinário e local
    if (v.crmvNumber !== '' && !/^\d{1,8}$/.test(v.crmvNumber)) issue('crmvNumber', 'validation.crmvInvalid');
    if (v.crmvUf !== '' && !isBrUf(v.crmvUf.toUpperCase())) issue('crmvUf', 'validation.ufInvalid');
    if (v.crmvNumber !== '' && v.crmvUf === '') issue('crmvUf', 'validation.required');
    if (v.placeKind !== 'home' && v.placeText === '') issue('placeText', 'validation.required');
  });

export type MedicationFormValues = z.infer<typeof medicationFormSchema>;

export function medicationFormDefaults(today: string = todayIso()): MedicationFormValues {
  return {
    name: '',
    barcode: '',
    batch: '',
    expiresOn: '',
    doseAmount: '',
    doseUnit: '',
    route: 'oral',
    frequencyKind: 'interval',
    everyHours: '',
    times: [],
    startDate: today,
    startTime: DEFAULT_START_TIME,
    continuous: false,
    endDate: '',
    prescribedOn: '',
    vetName: '',
    crmvNumber: '',
    crmvUf: '',
    placeKind: 'home',
    placeText: '',
    status: 'active',
    notes: '',
  };
}

/* -------------------------------------------------------------------------- */
/*  Dados salvos no Firestore                                                  */
/* -------------------------------------------------------------------------- */

const isoDate = z.string().refine(isValidIsoDate, { message: 'invalid ISO date' });
const hhmm = z.string().refine(isValidTime, { message: 'invalid time' });

export const frequencySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('interval'), everyHours: z.number().int().min(1).max(MAX_INTERVAL_HOURS) }),
  z.object({ kind: z.literal('fixed'), times: z.array(hhmm).min(1).max(MAX_FIXED_TIMES) }),
]);
export type Frequency = z.infer<typeof frequencySchema>;

export const medicationDataSchema = z.object({
  name: z.string().trim().min(1).max(80),
  barcode: z.string().max(64).optional(),
  batch: z.string().max(40).optional(),
  expiresOn: isoDate.optional(),
  dose: z.object({
    amount: z.string().min(1).max(20),
    unit: z.string().min(1).max(20),
    route: z.enum(MEDICATION_ROUTE),
  }),
  frequency: frequencySchema,
  startDate: isoDate,
  /** 1º horário (frequência "a cada X horas"); na frequência fixa não é usado. */
  startTime: hhmm.optional(),
  /** Último dia do tratamento (inclusive). Ausente = uso contínuo. */
  endDate: isoDate.optional(),
  prescribedOn: isoDate.optional(),
  vet: z
    .object({
      name: z.string().max(80).optional(),
      crmvNumber: z.string().regex(/^\d{1,8}$/).optional(),
      crmvUf: z.enum(BR_UF).optional(),
    })
    .optional(),
  place: z.object({ kind: z.enum(MEDICATION_PLACE), text: z.string().max(200).optional() }).optional(),
  status: z.enum(MEDICATION_STATUS),
  notes: z.string().max(1000).optional(),
});
export type MedicationData = z.infer<typeof medicationDataSchema>;

/** Campos opcionais que o formulário controla (para limpar o que a pessoa apagou). */
export const MEDICATION_FORM_OPTIONAL_KEYS = [
  'barcode',
  'batch',
  'expiresOn',
  'startTime',
  'endDate',
  'prescribedOn',
  'vet',
  'place',
  'notes',
] as const satisfies readonly (keyof MedicationData)[];

export const medicationDocSchema = medicationDataSchema.extend({
  /** Foto da receita e outros anexos (gerenciados na tela de anexos, fora do formulário). */
  attachments: z.array(attachmentRefSchema).max(MAX_ATTACHMENTS).optional(),
  createdBy: z.string().min(1),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
});
export type MedicationDoc = z.infer<typeof medicationDocSchema>;
export type Medication = MedicationDoc & { id: string };

/* -------------------------------------------------------------------------- */
/*  Conversões formulário <-> dados                                            */
/* -------------------------------------------------------------------------- */

export function medicationFormToData(values: MedicationFormValues): MedicationData {
  const data: MedicationData = {
    name: values.name.trim(),
    dose: { amount: values.doseAmount.trim(), unit: values.doseUnit.trim(), route: values.route },
    frequency:
      values.frequencyKind === 'interval'
        ? { kind: 'interval', everyHours: Number(values.everyHours) }
        : { kind: 'fixed', times: [...values.times].sort() },
    startDate: values.startDate,
    status: values.status,
  };

  if (values.frequencyKind === 'interval') data.startTime = values.startTime;
  if (!values.continuous && values.endDate) data.endDate = values.endDate;
  if (values.barcode.trim()) data.barcode = values.barcode.trim();
  if (values.batch.trim()) data.batch = values.batch.trim();
  if (values.expiresOn) data.expiresOn = values.expiresOn;
  if (values.prescribedOn) data.prescribedOn = values.prescribedOn;

  const vetName = values.vetName.trim();
  const crmvNumber = values.crmvNumber.trim();
  const crmvUf = values.crmvUf.trim().toUpperCase();
  if (vetName || crmvNumber) {
    data.vet = {};
    if (vetName) data.vet.name = vetName;
    if (crmvNumber) data.vet.crmvNumber = crmvNumber;
    if (crmvNumber && isBrUf(crmvUf)) data.vet.crmvUf = crmvUf;
  }

  if (values.placeKind === 'home') data.place = { kind: 'home' };
  else data.place = { kind: values.placeKind, text: values.placeText.trim() };

  if (values.notes.trim()) data.notes = values.notes.trim();
  return data;
}

export function medicationToFormValues(med: MedicationData, today: string = todayIso()): MedicationFormValues {
  return {
    ...medicationFormDefaults(today),
    name: med.name,
    barcode: med.barcode ?? '',
    batch: med.batch ?? '',
    expiresOn: med.expiresOn ?? '',
    doseAmount: med.dose.amount,
    doseUnit: med.dose.unit,
    route: med.dose.route,
    frequencyKind: med.frequency.kind,
    everyHours: med.frequency.kind === 'interval' ? String(med.frequency.everyHours) : '',
    times: med.frequency.kind === 'fixed' ? [...med.frequency.times] : [],
    startDate: med.startDate,
    startTime: med.startTime ?? DEFAULT_START_TIME,
    continuous: med.endDate === undefined,
    endDate: med.endDate ?? '',
    prescribedOn: med.prescribedOn ?? '',
    vetName: med.vet?.name ?? '',
    crmvNumber: med.vet?.crmvNumber ?? '',
    crmvUf: med.vet?.crmvUf ?? '',
    placeKind: med.place?.kind ?? 'home',
    placeText: med.place?.text ?? '',
    status: med.status,
    notes: med.notes ?? '',
  };
}
