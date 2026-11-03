import { describe, expect, it } from 'vitest';
import {
  attachmentExtension,
  attachmentPath,
  attachmentRefSchema,
  sanitizeAttachmentName,
} from './attachment';
import {
  HEALTH_EVENT_FORM_DEFAULTS,
  type HealthEventFormValues,
  healthEventDataSchema,
  healthEventFormSchema,
  healthEventFormToData,
  healthEventToFormValues,
} from './healthEvent';
import { VACCINE_FORM_DEFAULTS, type VaccineFormValues, vaccineDataSchema, vaccineFormSchema, vaccineFormToData, vaccineToFormValues } from './vaccine';
import { buildTimeline, upcomingDues } from '../healthTimeline';
import type { HealthEvent } from './healthEvent';
import type { Vaccine } from './vaccine';

const issues = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, values: unknown) => {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error!.issues.map((i) => `${i.path.join('.')}:${i.message}`);
};

const vaccine = (over: Partial<VaccineFormValues> = {}): VaccineFormValues => ({ ...VACCINE_FORM_DEFAULTS, name: 'V10', appliedOn: '2026-10-01', ...over });
const event = (over: Partial<HealthEventFormValues> = {}): HealthEventFormValues => ({
  ...HEALTH_EVENT_FORM_DEFAULTS,
  title: 'Consulta de rotina',
  date: '2026-10-01',
  ...over,
});

describe('vaccineFormSchema', () => {
  it('aceita só nome e data de aplicação', () => {
    expect(issues(vaccineFormSchema, vaccine())).toEqual([]);
  });
  it('exige nome e data; data inválida ou no futuro é recusada', () => {
    expect(issues(vaccineFormSchema, vaccine({ name: '', appliedOn: '' }))).toEqual(
      expect.arrayContaining(['name:validation.required', 'appliedOn:validation.required']),
    );
    expect(issues(vaccineFormSchema, vaccine({ appliedOn: 'invalid' }))).toContain('appliedOn:validation.dateInvalid');
    expect(issues(vaccineFormSchema, vaccine({ appliedOn: '2999-01-01' }))).toContain('appliedOn:validation.dateFuture');
  });
  it('a próxima dose precisa ser DEPOIS da aplicação', () => {
    expect(issues(vaccineFormSchema, vaccine({ nextDoseOn: '2026-10-01' }))).toContain('nextDoseOn:validation.nextBeforeDate');
    expect(issues(vaccineFormSchema, vaccine({ nextDoseOn: '2026-09-01' }))).toContain('nextDoseOn:validation.nextBeforeDate');
    expect(issues(vaccineFormSchema, vaccine({ nextDoseOn: '2027-10-01' }))).toEqual([]);
    expect(issues(vaccineFormSchema, vaccine({ nextDoseOn: 'invalid' }))).toContain('nextDoseOn:validation.dateInvalid');
  });
  it('CRMV: número só com dígitos e UF obrigatória', () => {
    expect(issues(vaccineFormSchema, vaccine({ crmvNumber: '12a' }))).toContain('crmvNumber:validation.crmvInvalid');
    expect(issues(vaccineFormSchema, vaccine({ crmvNumber: '123' }))).toContain('crmvUf:validation.required');
    expect(issues(vaccineFormSchema, vaccine({ crmvNumber: '123', crmvUf: 'sp' }))).toEqual([]);
  });
  it('conversão: campos vazios não são gravados e a ida e volta não perde nada', () => {
    const minimal = vaccineFormToData(vaccine());
    expect(Object.keys(minimal).sort()).toEqual(['appliedOn', 'name']);
    const full = vaccineFormToData(
      vaccine({ nextDoseOn: '2027-10-01', batch: 'L9', vetName: 'Dra. Ana', crmvNumber: '123', crmvUf: 'sp', clinic: 'Clínica X', notes: 'ok' }),
    );
    expect(full.vet).toEqual({ name: 'Dra. Ana', crmvNumber: '123', crmvUf: 'SP' });
    expect(vaccineDataSchema.safeParse(full).success).toBe(true);
    expect(vaccineFormToData(vaccineToFormValues(full))).toEqual(full);
  });
});

describe('healthEventFormSchema', () => {
  it('aceita consulta com título e data', () => {
    expect(issues(healthEventFormSchema, event())).toEqual([]);
  });
  it('exige título e data; recusa tipo desconhecido', () => {
    expect(issues(healthEventFormSchema, event({ title: ' ', date: '' }))).toEqual(
      expect.arrayContaining(['title:validation.required', 'date:validation.required']),
    );
    expect(issues(healthEventFormSchema, { ...event(), type: 'magic' })).not.toEqual([]);
  });
  it('o próximo retorno vem depois da data do evento', () => {
    expect(issues(healthEventFormSchema, event({ nextDate: '2026-10-01' }))).toContain('nextDate:validation.nextBeforeDate');
    expect(issues(healthEventFormSchema, event({ type: 'deworming', nextDate: '2026-12-01' }))).toEqual([]);
  });
  it.each(['consultation', 'deworming', 'flea_tick', 'exam', 'surgery', 'other'] as const)('tipo %s é aceito', (type) => {
    expect(issues(healthEventFormSchema, event({ type }))).toEqual([]);
  });
  it('conversão com ida e volta', () => {
    const data = healthEventFormToData(event({ type: 'exam', description: 'Hemograma', nextDate: '2027-01-01', vetName: 'Dr. Bia', crmvNumber: '9', crmvUf: 'RJ', clinic: 'Lab' }));
    expect(healthEventDataSchema.safeParse(data).success).toBe(true);
    expect(healthEventFormToData(healthEventToFormValues(data))).toEqual(data);
    expect(Object.keys(healthEventFormToData(event())).sort()).toEqual(['date', 'title', 'type']);
  });
});

describe('anexos', () => {
  const ref = { id: 'a1', path: 'pets/p1/attachments/r1/a1.pdf', name: 'exame.pdf', contentType: 'application/pdf', size: 1234, addedAt: '2026-11-04T10:00:00.000Z' };
  it('aceita PDF e JPEG; recusa outros tipos e arquivos acima de 10 MB', () => {
    expect(attachmentRefSchema.safeParse(ref).success).toBe(true);
    expect(attachmentRefSchema.safeParse({ ...ref, contentType: 'image/jpeg' }).success).toBe(true);
    expect(attachmentRefSchema.safeParse({ ...ref, contentType: 'application/zip' }).success).toBe(false);
    expect(attachmentRefSchema.safeParse({ ...ref, size: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });
  it('caminho no Storage fica dentro do pet e usa a extensão certa', () => {
    expect(attachmentPath('p1', 'r1', 'a1', 'application/pdf')).toBe('pets/p1/attachments/r1/a1.pdf');
    expect(attachmentPath('p1', 'r1', 'a1', 'image/jpeg')).toBe('pets/p1/attachments/r1/a1.jpg');
    expect(attachmentExtension('image/jpeg')).toBe('jpg');
  });
  it('o nome mostrado nunca carrega pastas nem caracteres de controle e tem limite', () => {
    expect(sanitizeAttachmentName('C:\\Users\\ana\\exame.pdf')).toBe('exame.pdf');
    expect(sanitizeAttachmentName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeAttachmentName('a\u0000b\nc.pdf')).toBe('abc.pdf');
    expect(sanitizeAttachmentName('x'.repeat(200))).toHaveLength(80);
    expect(sanitizeAttachmentName('   ')).toBe('arquivo');
  });
});

describe('linha do tempo', () => {
  const v = (id: string, appliedOn: string, nextDoseOn?: string, attachments = 0): Vaccine => ({
    id, name: `Vacina ${id}`, appliedOn, nextDoseOn, createdBy: 'u1',
    attachments: Array.from({ length: attachments }, (_, i) => ({ id: `a${i}`, path: 'p', name: 'n', contentType: 'image/jpeg' as const, size: 1, addedAt: '2026-01-01T00:00:00.000Z' })),
  });
  const e = (id: string, date: string, nextDate?: string): HealthEvent => ({ id, type: 'exam', title: `Evento ${id}`, date, nextDate, createdBy: 'u1' });

  it('mistura vacinas e eventos, do mais recente ao mais antigo, com desempate estável', () => {
    const items = buildTimeline([v('v1', '2026-03-01'), v('v2', '2026-09-01')], [e('e1', '2026-05-01'), e('e2', '2026-09-01')]);
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual(['event:e2', 'vaccine:v2', 'event:e1', 'vaccine:v1']);
  });
  it('indica se há anexos', () => {
    const [item] = buildTimeline([v('v1', '2026-03-01', undefined, 2)], []);
    expect(item!.hasAttachments).toBe(true);
  });
  it('upcomingDues lista só datas de hoje em diante, da mais próxima à mais distante', () => {
    const items = buildTimeline([v('v1', '2026-03-01', '2026-11-20'), v('v2', '2026-01-01', '2026-10-01')], [e('e1', '2026-05-01', '2026-11-04'), e('e2', '2026-05-01')]);
    expect(upcomingDues(items, '2026-11-04').map((i) => i.id)).toEqual(['e1', 'v1']);
  });
});
