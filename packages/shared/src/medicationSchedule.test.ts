import { describe, expect, it } from 'vitest';
import {
  ALERT_TIME,
  buildReminderPlan,
  doseTimesBetween,
  dueDoses,
  expiryStatus,
  isTreatmentOver,
  nextDose,
  type PlanMedication,
  type Schedulable,
} from './medicationSchedule';
import { doseLogId } from './schemas/doseLog';
import type { MedicationData } from './schemas/medication';

/** Atalho: data/hora LOCAL. */
const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm, 0, 0);
const fmt = (dates: Date[]) =>
  dates.map((d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

const interval = (everyHours: number, extra: Partial<Schedulable> = {}): Schedulable => ({
  frequency: { kind: 'interval', everyHours },
  startDate: '2026-11-04',
  startTime: '06:00',
  status: 'active',
  ...extra,
});
const fixed = (times: string[], extra: Partial<Schedulable> = {}): Schedulable => ({
  frequency: { kind: 'fixed', times },
  startDate: '2026-11-04',
  status: 'active',
  ...extra,
});

describe('ambiente de teste', () => {
  it('usa o fuso de São Paulo (UTC-3, sem horário de verão)', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(180);
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(180);
  });
});

describe('doseTimesBetween — a cada X horas', () => {
  it('conta a partir do 1º horário, de X em X horas', () => {
    const doses = doseTimesBetween(interval(8), at(2026, 11, 4, 0), at(2026, 11, 5, 0));
    expect(fmt(doses)).toEqual(['04/11 06:00', '04/11 14:00', '04/11 22:00']);
  });

  it('não gera doses antes do início', () => {
    expect(doseTimesBetween(interval(8), at(2026, 11, 3, 0), at(2026, 11, 4, 5, 59))).toEqual([]);
  });

  it('mantém o ritmo mesmo começando a olhar dias depois (não reinicia a conta)', () => {
    const med = interval(8, { startDate: '2026-11-01' });
    expect(fmt(doseTimesBetween(med, at(2026, 11, 4, 7), at(2026, 11, 4, 23)))).toEqual(['04/11 14:00', '04/11 22:00']);
    // 3 dias = 72 h = 9 doses de 8 h: a dose das 06:00 do dia 4 é exatamente a n=9
    expect(fmt(doseTimesBetween(med, at(2026, 11, 4, 6), at(2026, 11, 4, 6)))).toEqual(['04/11 06:00']);
  });

  it('inclui os dois extremos da janela', () => {
    const doses = doseTimesBetween(interval(8), at(2026, 11, 4, 6), at(2026, 11, 4, 14));
    expect(fmt(doses)).toEqual(['04/11 06:00', '04/11 14:00']);
  });

  it('atravessa a meia-noite e respeita o último dia (inclusive)', () => {
    const med = interval(12, { startTime: '20:00', endDate: '2026-11-05' });
    const doses = doseTimesBetween(med, at(2026, 11, 4, 0), at(2026, 11, 10, 0));
    expect(fmt(doses)).toEqual(['04/11 20:00', '05/11 08:00', '05/11 20:00']);
  });

  it('uso contínuo (sem data final) segue indefinidamente', () => {
    const doses = doseTimesBetween(interval(24), at(2026, 11, 4, 0), at(2026, 12, 4, 0));
    expect(doses).toHaveLength(30); // 04/11 a 03/12, às 06:00
  });

  it('intervalos longos (semanal) funcionam', () => {
    const doses = doseTimesBetween(interval(168), at(2026, 11, 4, 0), at(2026, 12, 1, 0));
    expect(fmt(doses)).toEqual(['04/11 06:00', '11/11 06:00', '18/11 06:00', '25/11 06:00']);
  });

  it('usa 08:00 se o 1º horário não foi guardado', () => {
    const med = interval(24, { startTime: undefined });
    expect(fmt(doseTimesBetween(med, at(2026, 11, 4, 0), at(2026, 11, 4, 23)))).toEqual(['04/11 08:00']);
  });
});

describe('doseTimesBetween — horários fixos', () => {
  it('gera os horários de cada dia, em ordem, mesmo se informados fora de ordem', () => {
    const doses = doseTimesBetween(fixed(['20:00', '08:00']), at(2026, 11, 4, 0), at(2026, 11, 5, 23, 59));
    expect(fmt(doses)).toEqual(['04/11 08:00', '04/11 20:00', '05/11 08:00', '05/11 20:00']);
  });

  it('só dentro da janela pedida', () => {
    const doses = doseTimesBetween(fixed(['08:00', '20:00']), at(2026, 11, 4, 9), at(2026, 11, 5, 9));
    expect(fmt(doses)).toEqual(['04/11 20:00', '05/11 08:00']);
  });

  it('não gera antes do dia de início nem depois do último dia (inclusive)', () => {
    const med = fixed(['08:00', '20:00'], { startDate: '2026-11-05', endDate: '2026-11-06' });
    const doses = doseTimesBetween(med, at(2026, 11, 3, 0), at(2026, 11, 10, 0));
    expect(fmt(doses)).toEqual(['05/11 08:00', '05/11 20:00', '06/11 08:00', '06/11 20:00']);
  });
});

describe('doseTimesBetween — status e limites', () => {
  it.each(['completed', 'suspended'] as const)('medicamento "%s" não gera doses', (status) => {
    expect(doseTimesBetween(interval(8, { status }), at(2026, 11, 4), at(2026, 11, 8))).toEqual([]);
    expect(doseTimesBetween(fixed(['08:00'], { status }), at(2026, 11, 4), at(2026, 11, 8))).toEqual([]);
  });

  it('janela invertida devolve vazio', () => {
    expect(doseTimesBetween(interval(8), at(2026, 11, 5), at(2026, 11, 4))).toEqual([]);
  });

  it('nunca devolve mais que o limite de segurança', () => {
    expect(doseTimesBetween(interval(1), at(2026, 1, 1), at(2030, 1, 1)).length).toBeLessThanOrEqual(2000);
  });
});

describe('nextDose', () => {
  it('é a primeira dose DEPOIS de agora', () => {
    expect(fmt([nextDose(interval(8), at(2026, 11, 4, 14))!])).toEqual(['04/11 22:00']);
    expect(fmt([nextDose(interval(8), at(2026, 11, 4, 13, 59))!])).toEqual(['04/11 14:00']);
  });
  it('é null quando o tratamento já acabou ou não está em uso', () => {
    expect(nextDose(interval(8, { endDate: '2026-11-04' }), at(2026, 11, 5))).toBeNull();
    expect(nextDose(interval(8, { status: 'suspended' }), at(2026, 11, 4))).toBeNull();
  });
  it('encontra a dose de um tratamento semanal', () => {
    expect(fmt([nextDose(interval(168), at(2026, 11, 4, 7))!])).toEqual(['11/11 06:00']);
  });
});

describe('dueDoses (doses para registrar)', () => {
  const med = interval(8);
  const noon = at(2026, 11, 4, 15);

  it('lista as doses que já passaram e não foram registradas', () => {
    expect(fmt(dueDoses('m1', med, noon, new Set()))).toEqual(['04/11 06:00', '04/11 14:00']);
  });

  it('esconde as que já foram dadas ou puladas', () => {
    const logged = new Set([doseLogId('m1', at(2026, 11, 4, 6))]);
    expect(fmt(dueDoses('m1', med, noon, logged))).toEqual(['04/11 14:00']);
  });

  it('só olha para as últimas 24 h', () => {
    const doses = dueDoses('m1', interval(8, { startDate: '2026-11-01' }), noon, new Set());
    expect(doses.every((d) => d.getTime() >= noon.getTime() - 24 * 3_600_000)).toBe(true);
  });
});

describe('doseLogId', () => {
  it('é estável, por minuto, e distingue remédios', () => {
    const a = at(2026, 11, 4, 6, 0);
    const sameMinute = new Date(a.getTime() + 30_000);
    expect(doseLogId('m1', a)).toBe(doseLogId('m1', sameMinute));
    expect(doseLogId('m1', a)).not.toBe(doseLogId('m2', a));
    expect(doseLogId('m1', a)).not.toBe(doseLogId('m1', at(2026, 11, 4, 14, 0)));
    expect(doseLogId('m1', a)).toMatch(/^m1_\d+$/);
  });
});

describe('validade e fim do tratamento', () => {
  it('expiryStatus', () => {
    expect(expiryStatus(undefined, '2026-11-04')).toBeNull();
    expect(expiryStatus('2026-11-03', '2026-11-04')).toBe('expired');
    expect(expiryStatus('2026-11-04', '2026-11-04')).toBe('soon');
    expect(expiryStatus('2026-12-04', '2026-11-04')).toBe('soon');
    expect(expiryStatus('2026-12-05', '2026-11-04')).toBeNull();
  });
  it('isTreatmentOver só vale para "em uso" com data final no passado', () => {
    expect(isTreatmentOver({ status: 'active', endDate: '2026-11-03' }, '2026-11-04')).toBe(true);
    expect(isTreatmentOver({ status: 'active', endDate: '2026-11-04' }, '2026-11-04')).toBe(false);
    expect(isTreatmentOver({ status: 'active' }, '2026-11-04')).toBe(false);
    expect(isTreatmentOver({ status: 'completed', endDate: '2026-11-01' }, '2026-11-04')).toBe(false);
  });
});

describe('buildReminderPlan', () => {
  const now = at(2026, 11, 4, 12);
  const med = (id: string, data: Partial<MedicationData>, petId = 'p1'): PlanMedication => ({
    petId,
    id,
    med: {
      name: 'X',
      dose: { amount: '1', unit: 'comprimido', route: 'oral' },
      frequency: { kind: 'interval', everyHours: 8 },
      startDate: '2026-11-01',
      startTime: '06:00',
      status: 'active',
      ...data,
    },
  });

  it('agenda só a janela móvel (72 h) e em ordem cronológica', () => {
    const plan = buildReminderPlan([med('m1', {})], now, new Set());
    expect(plan.every((i) => i.at > now && i.at.getTime() <= now.getTime() + 72 * 3_600_000)).toBe(true);
    expect(plan.map((i) => i.at.getTime())).toEqual([...plan.map((i) => i.at.getTime())].sort((a, b) => a - b));
    expect(plan).toHaveLength(9); // 72 h / 8 h
    expect(plan.every((i) => i.kind === 'dose')).toBe(true);
  });

  it('pula doses já registradas (dei ou pulei)', () => {
    const first = buildReminderPlan([med('m1', {})], now, new Set())[0]!;
    const plan = buildReminderPlan([med('m1', {})], now, new Set([first.key]));
    expect(plan.find((i) => i.key === first.key)).toBeUndefined();
    expect(plan).toHaveLength(8);
  });

  it('respeita o limite do iOS: no máximo 60, ficando com as mais próximas', () => {
    const many = Array.from({ length: 10 }, (_, i) => med(`m${i}`, { frequency: { kind: 'interval', everyHours: 1 } }));
    const plan = buildReminderPlan(many, now, new Set());
    expect(plan).toHaveLength(60);
    const latest = plan[plan.length - 1]!.at.getTime();
    expect(latest).toBeLessThan(now.getTime() + 72 * 3_600_000);
  });

  it('mistura vários remédios e pets, sem repetir chaves', () => {
    const plan = buildReminderPlan(
      [med('m1', {}), med('m2', { frequency: { kind: 'fixed', times: ['09:00'] } }, 'p2')],
      now,
      new Set(),
    );
    expect(new Set(plan.map((i) => i.key)).size).toBe(plan.length);
    expect(plan.some((i) => i.petId === 'p2')).toBe(true);
  });

  it('ignora remédios concluídos ou suspensos', () => {
    expect(buildReminderPlan([med('m1', { status: 'completed' }), med('m2', { status: 'suspended' })], now, new Set())).toEqual([]);
  });

  it('avisa o fim do tratamento no dia anterior e no último dia, às 09:00', () => {
    const plan = buildReminderPlan([med('m1', { endDate: '2026-11-06', frequency: { kind: 'interval', everyHours: 168 } })], now, new Set());
    const ends = plan.filter((i) => i.kind !== 'dose');
    expect(ends.map((i) => [i.kind, ...fmt([i.at])])).toEqual([
      ['ends_tomorrow', `05/11 ${ALERT_TIME}`],
      ['ends_today', `06/11 ${ALERT_TIME}`],
    ]);
  });

  it('avisa a validade 7 dias antes e no dia (olhando 30 dias à frente)', () => {
    const soon = buildReminderPlan([med('m1', { expiresOn: '2026-11-11' })], now, new Set()).filter((i) => i.kind !== 'dose');
    // o aviso de 04/11 09:00 já passou (agora são 12:00); sobra o do próprio dia
    expect(soon.map((i) => [i.kind, ...fmt([i.at])])).toEqual([['expires_today', `11/11 ${ALERT_TIME}`]]);
    const near = buildReminderPlan([med('m1', { expiresOn: '2026-11-12' })], now, new Set()).filter((i) => i.kind !== 'dose');
    expect(near.map((i) => [i.kind, ...fmt([i.at])])).toEqual([
      ['expires_soon', `05/11 ${ALERT_TIME}`],
      ['expires_today', `12/11 ${ALERT_TIME}`],
    ]);
  });

  it('avisos além de 30 dias ainda não são agendados', () => {
    expect(buildReminderPlan([med('m1', { expiresOn: '2027-03-01' })], now, new Set()).filter((i) => i.kind !== 'dose')).toEqual([]);
  });

  it('não gera aviso de validade já vencida (passado)', () => {
    expect(buildReminderPlan([med('m1', { expiresOn: '2026-10-01', frequency: { kind: 'interval', everyHours: 168 } })], now, new Set()).filter((i) => i.kind !== 'dose')).toEqual([]);
  });

  describe('próxima dose de vacinas e eventos de saúde', () => {
    const due = (source: 'vaccine' | 'event', dueOn: string, id = 'v1') => ({ petId: 'p1', id, source, dueOn });

    it('avisa na véspera e no dia, às 09:00', () => {
      const plan = buildReminderPlan([], now, new Set(), { dues: [due('vaccine', '2026-11-20')] });
      expect(plan.map((i) => [i.kind, i.refId, ...fmt([i.at])])).toEqual([
        ['vaccine_tomorrow', 'v1', `19/11 ${ALERT_TIME}`],
        ['vaccine_today', 'v1', `20/11 ${ALERT_TIME}`],
      ]);
    });

    it('eventos (vermífugo, antipulgas...) usam os avisos próprios', () => {
      const plan = buildReminderPlan([], now, new Set(), { dues: [due('event', '2026-11-06', 'e1')] });
      expect(plan.map((i) => i.kind)).toEqual(['event_tomorrow', 'event_today']);
    });

    it('não agenda o que já passou nem o que está além de 30 dias', () => {
      const plan = buildReminderPlan([], now, new Set(), { dues: [due('vaccine', '2026-11-03', 'old'), due('vaccine', '2027-02-01', 'far')] });
      expect(plan).toEqual([]);
    });

    it('as chaves não colidem entre remédios, vacinas e eventos', () => {
      const plan = buildReminderPlan(
        [med('m1', { endDate: '2026-11-06', frequency: { kind: 'interval', everyHours: 168 } })],
        now,
        new Set(),
        { dues: [due('vaccine', '2026-11-06', 'v1'), due('event', '2026-11-06', 'e1')] },
      );
      expect(new Set(plan.map((i) => i.key)).size).toBe(plan.length);
    });

    it('as mais próximas vêm primeiro quando passa do limite', () => {
      const dues = Array.from({ length: 40 }, (_, i) => due('vaccine', `2026-11-${String(5 + (i % 20)).padStart(2, '0')}`, `v${i}`));
      const plan = buildReminderPlan([], now, new Set(), { dues, max: 10 });
      expect(plan).toHaveLength(10);
      expect(plan.map((i) => i.at.getTime())).toEqual([...plan.map((i) => i.at.getTime())].sort((a, b) => a - b));
    });
  });
});
