import { describe, expect, it } from 'vitest';
import { isAfterIso, isValidIsoDate, monthsBetween, todayIso } from './dates';

describe('isValidIsoDate', () => {
  it('aceita datas reais, inclusive 29/02 em ano bissexto', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-11-03')).toBe(true);
  });
  it('rejeita datas impossíveis ou mal formatadas', () => {
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-00-10')).toBe(false);
    expect(isValidIsoDate('2026-04-31')).toBe(false);
    expect(isValidIsoDate('03/11/2026')).toBe(false);
    expect(isValidIsoDate('invalid')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('todayIso', () => {
  it('usa o fuso local e preenche com zeros', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('isAfterIso', () => {
  it('compara cronologicamente', () => {
    expect(isAfterIso('2026-11-04', '2026-11-03')).toBe(true);
    expect(isAfterIso('2026-11-03', '2026-11-03')).toBe(false);
  });
});

describe('monthsBetween', () => {
  it('conta meses completos', () => {
    expect(monthsBetween('2025-11-03', '2026-11-03')).toBe(12);
    expect(monthsBetween('2025-11-04', '2026-11-03')).toBe(11);
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(0);
  });
  it('retorna 0 quando a ordem está invertida ou a data é inválida', () => {
    expect(monthsBetween('2027-01-01', '2026-01-01')).toBe(0);
    expect(monthsBetween('x', '2026-01-01')).toBe(0);
  });
});
