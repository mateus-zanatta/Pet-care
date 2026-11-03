import { describe, expect, it } from 'vitest';
import {
  type MedicationFormValues,
  medicationDataSchema,
  medicationFormDefaults,
  medicationFormSchema,
  medicationFormToData,
  medicationToFormValues,
} from './medication';

const TODAY = '2026-11-04';

/** Formulário válido mínimo: "a cada 8 horas" por tempo determinado. */
const valid = (extra: Partial<MedicationFormValues> = {}): MedicationFormValues => ({
  ...medicationFormDefaults(TODAY),
  name: 'Amoxicilina',
  doseAmount: '1/2',
  doseUnit: 'comprimido',
  everyHours: '8',
  endDate: '2026-11-11',
  ...extra,
});

const messages = (values: MedicationFormValues) => {
  const result = medicationFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
};

describe('medicationFormSchema', () => {
  it('aceita um tratamento "a cada 8 horas" por tempo determinado', () => {
    expect(messages(valid())).toEqual([]);
  });

  it('exige nome, dose e unidade — e guarda a dose "exatamente como prescrita" (ex.: 1/2, 2,5)', () => {
    expect(messages(valid({ name: '  ', doseAmount: '', doseUnit: '' }))).toEqual(
      expect.arrayContaining(['name:validation.required', 'doseAmount:validation.required', 'doseUnit:validation.required']),
    );
    expect(medicationFormToData(valid({ doseAmount: ' 2,5 ' })).dose.amount).toBe('2,5');
  });

  describe('frequência', () => {
    it.each([['0'], ['169'], ['abc'], ['1,5']])('"a cada X horas" rejeita %s', (everyHours) => {
      expect(messages(valid({ everyHours }))).toContain('everyHours:validation.hoursInvalid');
    });
    it('"a cada X horas" exige o número e um 1º horário válido', () => {
      expect(messages(valid({ everyHours: '' }))).toContain('everyHours:validation.required');
      expect(messages(valid({ startTime: '25:00' }))).toContain('startTime:validation.timeInvalid');
    });
    it('horários fixos exigem pelo menos um, válidos e sem repetir', () => {
      const fixed = { frequencyKind: 'fixed' as const, everyHours: '' };
      expect(messages(valid({ ...fixed, times: [] }))).toContain('times:validation.timesRequired');
      expect(messages(valid({ ...fixed, times: ['8:00'] }))).toContain('times:validation.timeInvalid');
      expect(messages(valid({ ...fixed, times: ['08:00', '08:00'] }))).toContain('times:validation.timesDuplicate');
      expect(messages(valid({ ...fixed, times: Array.from({ length: 13 }, (_, i) => `${String(i).padStart(2, '0')}:00`) }))).toContain(
        'times:validation.timesTooMany',
      );
      expect(messages(valid({ ...fixed, times: ['08:00', '20:00'] }))).toEqual([]);
    });
  });

  describe('duração e datas', () => {
    it('por tempo determinado exige a data final, que não pode ser antes do início', () => {
      expect(messages(valid({ endDate: '' }))).toContain('endDate:validation.required');
      expect(messages(valid({ endDate: '2026-11-03' }))).toContain('endDate:validation.endBeforeStart');
      expect(messages(valid({ endDate: '2026-11-04' }))).toEqual([]); // um dia só
    });
    it('uso contínuo dispensa a data final', () => {
      expect(messages(valid({ continuous: true, endDate: '' }))).toEqual([]);
    });
    it('rejeita datas inválidas e prescrição no futuro', () => {
      expect(messages(valid({ startDate: 'invalid' }))).toContain('startDate:validation.dateInvalid');
      expect(messages(valid({ expiresOn: 'invalid' }))).toContain('expiresOn:validation.dateInvalid');
      expect(messages(valid({ prescribedOn: '2999-01-01' }))).toContain('prescribedOn:validation.dateFuture');
    });
    it('aceita validade já vencida (o app só avisa)', () => {
      expect(messages(valid({ expiresOn: '2020-01-01' }))).toEqual([]);
    });
  });

  describe('veterinário e local', () => {
    it('CRMV: número só com dígitos e UF obrigatória quando há número', () => {
      expect(messages(valid({ crmvNumber: '12a' }))).toContain('crmvNumber:validation.crmvInvalid');
      expect(messages(valid({ crmvNumber: '12345' }))).toContain('crmvUf:validation.required');
      expect(messages(valid({ crmvNumber: '12345', crmvUf: 'ZZ' }))).toContain('crmvUf:validation.ufInvalid');
      expect(messages(valid({ crmvNumber: '12345', crmvUf: 'sp' }))).toEqual([]);
    });
    it('clínica ou endereço exigem o texto; "em casa" não', () => {
      expect(messages(valid({ placeKind: 'clinic', placeText: '' }))).toContain('placeText:validation.required');
      expect(messages(valid({ placeKind: 'address', placeText: 'Rua A, 10' }))).toEqual([]);
      expect(messages(valid({ placeKind: 'home' }))).toEqual([]);
    });
  });
});

describe('conversões formulário <-> dados', () => {
  it('"a cada X horas": guarda o número, o 1º horário e a data final; o resultado passa no schema de dados', () => {
    const data = medicationFormToData(valid({ barcode: ' 7891234567895 ', batch: 'L123', expiresOn: '2027-03-01', notes: ' sem reações ' }));
    expect(data).toMatchObject({
      name: 'Amoxicilina',
      dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
      frequency: { kind: 'interval', everyHours: 8 },
      startDate: TODAY,
      startTime: '08:00',
      endDate: '2026-11-11',
      barcode: '7891234567895',
      batch: 'L123',
      expiresOn: '2027-03-01',
      status: 'active',
      notes: 'sem reações',
      place: { kind: 'home' },
    });
    expect(medicationDataSchema.safeParse(data).success).toBe(true);
  });

  it('horários fixos ficam ordenados e sem startTime', () => {
    const data = medicationFormToData(valid({ frequencyKind: 'fixed', everyHours: '', times: ['20:00', '08:00'] }));
    expect(data.frequency).toEqual({ kind: 'fixed', times: ['08:00', '20:00'] });
    expect(data.startTime).toBeUndefined();
    expect(medicationDataSchema.safeParse(data).success).toBe(true);
  });

  it('uso contínuo não grava data final; campos vazios não são gravados', () => {
    const data = medicationFormToData(valid({ continuous: true, endDate: '2026-11-11' }));
    expect('endDate' in data).toBe(false);
    for (const key of ['barcode', 'batch', 'expiresOn', 'prescribedOn', 'vet', 'notes']) expect(key in data).toBe(false);
  });

  it('veterinário e local', () => {
    const data = medicationFormToData(
      valid({ vetName: 'Dra. Ana', crmvNumber: '12345', crmvUf: 'sp', placeKind: 'clinic', placeText: 'Clínica Pet Feliz' }),
    );
    expect(data.vet).toEqual({ name: 'Dra. Ana', crmvNumber: '12345', crmvUf: 'SP' });
    expect(data.place).toEqual({ kind: 'clinic', text: 'Clínica Pet Feliz' });
    expect(medicationDataSchema.safeParse(data).success).toBe(true);
  });

  it('ida e volta: dados -> formulário -> dados não perde nada', () => {
    const original = medicationFormToData(
      valid({
        frequencyKind: 'fixed',
        everyHours: '',
        times: ['08:00', '20:00'],
        continuous: true,
        endDate: '',
        vetName: 'Dr. Bia',
        crmvNumber: '999',
        crmvUf: 'RJ',
        placeKind: 'address',
        placeText: 'Rua B, 20',
        expiresOn: '2027-01-31',
        status: 'suspended',
      }),
    );
    expect(medicationFormToData(medicationToFormValues(original, TODAY))).toEqual(original);
  });

  it('a medicação nunca recebe campos de sugestão (o app só registra o que foi prescrito)', () => {
    const keys = Object.keys(medicationFormToData(valid()));
    expect(keys.filter((k) => /suggest|recommend|diagnos/i.test(k))).toEqual([]);
  });
});
