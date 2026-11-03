import { describe, expect, it } from 'vitest';
import { isRecentLogin } from './recentLogin';

const now = Date.UTC(2026, 10, 3, 12, 0, 0);
const sec = (offsetSeconds: number) => now / 1000 + offsetSeconds;

describe('isRecentLogin', () => {
  it('aceita login de poucos minutos atrás', () => {
    expect(isRecentLogin(sec(-30), now)).toBe(true);
    expect(isRecentLogin(sec(-299), now)).toBe(true);
  });
  it('rejeita login antigo', () => {
    expect(isRecentLogin(sec(-301), now)).toBe(false);
    expect(isRecentLogin(sec(-86_400), now)).toBe(false);
  });
  it('rejeita ausência de auth_time e valores absurdos', () => {
    expect(isRecentLogin(undefined, now)).toBe(false);
    expect(isRecentLogin(Number.NaN, now)).toBe(false);
    expect(isRecentLogin(sec(3600), now)).toBe(false); // data no futuro
  });
});
