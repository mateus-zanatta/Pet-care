import { type MedicationData, doseLogId } from '@petcare/shared';
import { buildMedicationUpdate, parseDoseLog, parseMedication, sortMedications } from './medications.mapper';

const base: MedicationData = {
  name: 'Amoxicilina',
  dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
  frequency: { kind: 'interval', everyHours: 8 },
  startDate: '2026-11-04',
  startTime: '08:00',
  endDate: '2026-11-11',
  status: 'active',
  place: { kind: 'home' },
};

describe('parseMedication', () => {
  it('lê um documento válido e acrescenta o ID', () => {
    const med = parseMedication('m1', { ...base, createdBy: 'u1', createdAt: null, updatedAt: null });
    expect(med).toMatchObject({ id: 'm1', name: 'Amoxicilina', createdBy: 'u1' });
  });
  it('documento corrompido vira null em vez de quebrar a tela', () => {
    expect(parseMedication('m1', { ...base, createdBy: 'u1', status: 'paused' })).toBeNull();
    expect(parseMedication('m1', { name: 'x' })).toBeNull();
    expect(parseMedication('m1', undefined)).toBeNull();
  });
});

describe('parseDoseLog', () => {
  const log = {
    medicationId: 'm1',
    scheduledFor: '2026-11-04T11:00:00.000Z',
    outcome: 'given',
    actualAt: '2026-11-04T11:05:00.000Z',
    byUid: 'u1',
    createdAt: 'TS',
  };
  it('lê um registro válido', () => {
    expect(parseDoseLog('m1_1', log)).toMatchObject({ id: 'm1_1', outcome: 'given', byUid: 'u1' });
  });
  it('ignora registros inválidos', () => {
    expect(parseDoseLog('x', { ...log, outcome: 'maybe' })).toBeNull();
    expect(parseDoseLog('x', { ...log, scheduledFor: 'ontem' })).toBeNull();
  });
  it('o ID do registro bate com o cálculo compartilhado', () => {
    expect(doseLogId('m1', new Date('2026-11-04T11:00:00.000Z'))).toMatch(/^m1_\d+$/);
  });
});

describe('buildMedicationUpdate', () => {
  it('campos opcionais apagados no formulário viram "remover"; autoria e criação não são tocadas', () => {
    const { endDate: _e, startTime: _s, place: _p, ...withoutOptionals } = base;
    const update = buildMedicationUpdate(withoutOptionals as MedicationData, 'DELETE');
    expect(update.endDate).toBe('DELETE');
    expect(update.startTime).toBe('DELETE');
    expect(update.barcode).toBe('DELETE');
    expect(update.name).toBe('Amoxicilina');
    expect('createdBy' in update).toBe(false);
    expect('createdAt' in update).toBe(false);
  });
  it('mantém os opcionais preenchidos', () => {
    const update = buildMedicationUpdate({ ...base, batch: 'L1' }, 'DELETE');
    expect(update.batch).toBe('L1');
    expect(update.endDate).toBe('2026-11-11');
  });
});

describe('sortMedications', () => {
  it('em uso primeiro, depois suspensos, depois concluídos; por nome dentro de cada grupo', () => {
    const sorted = sortMedications([
      { name: 'B', status: 'completed' },
      { name: 'Z', status: 'active' },
      { name: 'A', status: 'active' },
      { name: 'M', status: 'suspended' },
    ]);
    expect(sorted.map((m) => m.name)).toEqual(['A', 'Z', 'M', 'B']);
  });
});
