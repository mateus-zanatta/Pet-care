import { formatClock, formatWhen, frequencySummary } from './format';
import meds from '@/locales/pt-BR/meds.json';

const t = (key: string, vars: Record<string, unknown> = {}): string => {
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], meds);
  return String(value).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars[name] ?? ''));
};

describe('formatClock', () => {
  it('usa 24 h com zero à esquerda', () => {
    expect(formatClock(new Date(2026, 10, 4, 8, 5))).toBe('08:05');
    expect(formatClock(new Date(2026, 10, 4, 23, 40))).toBe('23:40');
  });
});

describe('frequencySummary', () => {
  it('a cada X horas', () => {
    expect(frequencySummary({ kind: 'interval', everyHours: 8 }, t)).toBe('A cada 8 h');
  });
  it('horários fixos, em ordem', () => {
    expect(frequencySummary({ kind: 'fixed', times: ['20:00', '08:00'] }, t)).toBe('Todo dia às 08:00, 20:00');
  });
});

describe('formatWhen', () => {
  const now = new Date(2026, 10, 4, 12, 0);
  it('hoje, amanhã e outros dias', () => {
    expect(formatWhen(new Date(2026, 10, 4, 14, 0), now, 'pt-BR', t)).toBe('hoje às 14:00');
    expect(formatWhen(new Date(2026, 10, 5, 8, 0), now, 'pt-BR', t)).toBe('amanhã às 08:00');
    expect(formatWhen(new Date(2026, 10, 7, 8, 0), now, 'pt-BR', t)).toMatch(/^07\/11\/2026 às 08:00$/);
  });
  it('vira o mês corretamente ("amanhã" no último dia do mês)', () => {
    expect(formatWhen(new Date(2026, 11, 1, 9, 0), new Date(2026, 10, 30, 20, 0), 'pt-BR', t)).toBe('amanhã às 09:00');
  });
});
