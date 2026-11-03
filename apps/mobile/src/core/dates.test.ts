import { INVALID_DATE, isoToInput, maskDateInput, parseDateInput } from './dates';

describe('maskDateInput', () => {
  it('insere as barras enquanto digita e ignora o que não é número', () => {
    expect(maskDateInput('0')).toBe('0');
    expect(maskDateInput('031')).toBe('03/1');
    expect(maskDateInput('03112026')).toBe('03/11/2026');
    expect(maskDateInput('03/11/2026')).toBe('03/11/2026');
    expect(maskDateInput('ab03-11x2026999')).toBe('03/11/2026');
  });
});

describe('parseDateInput', () => {
  it('converte para ISO conforme a ordem do idioma', () => {
    expect(parseDateInput('03/11/2026', 'DMY')).toBe('2026-11-03');
    expect(parseDateInput('11/03/2026', 'MDY')).toBe('2026-11-03');
  });
  it('vazio continua vazio', () => {
    expect(parseDateInput('  ', 'DMY')).toBe('');
  });
  it('marca como inválido o incompleto e o impossível', () => {
    expect(parseDateInput('03/11', 'DMY')).toBe(INVALID_DATE);
    expect(parseDateInput('31/02/2026', 'DMY')).toBe(INVALID_DATE);
    expect(parseDateInput('13/13/2026', 'MDY')).toBe(INVALID_DATE);
  });
});

describe('isoToInput', () => {
  it('formata conforme o idioma', () => {
    expect(isoToInput('2026-11-03', 'DMY')).toBe('03/11/2026');
    expect(isoToInput('2026-11-03', 'MDY')).toBe('11/03/2026');
    expect(isoToInput('lixo', 'DMY')).toBe('');
  });
  it('ida e volta', () => {
    expect(parseDateInput(isoToInput('2024-02-29', 'DMY'), 'DMY')).toBe('2024-02-29');
  });
});
