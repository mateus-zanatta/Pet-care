import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PET_FORM_DEFAULTS,
  type PetFormValues,
  computePetAgeMonths,
  parseDecimal,
  petDataSchema,
  petFormSchema,
  petFormToData,
  petToFormValues,
} from './pet';

const valid = (overrides: Partial<PetFormValues> = {}): PetFormValues => ({
  ...PET_FORM_DEFAULTS,
  name: 'Mel',
  ...overrides,
});

const messages = (values: PetFormValues) => {
  const result = petFormSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 3, 12, 0, 0)); // 03/11/2026 (hora local)
});
afterEach(() => vi.useRealTimers());

describe('parseDecimal', () => {
  it('aceita vírgula e ponto', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal(' 8 ')).toBe(8);
  });
  it('rejeita vazio e lixo', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
  });
});

describe('petFormSchema', () => {
  it('aceita o mínimo: só o nome', () => {
    expect(messages(valid())).toEqual([]);
  });

  it('exige nome', () => {
    expect(messages(valid({ name: '   ' }))).toContain('name:validation.required');
  });

  it('valida data de nascimento no modo "data"', () => {
    expect(messages(valid({ birthMode: 'date', birthDate: '' }))).toContain(
      'birthDate:validation.required',
    );
    expect(messages(valid({ birthMode: 'date', birthDate: 'invalid' }))).toContain(
      'birthDate:validation.dateInvalid',
    );
    expect(messages(valid({ birthMode: 'date', birthDate: '2026-11-04' }))).toContain(
      'birthDate:validation.dateFuture',
    );
    expect(messages(valid({ birthMode: 'date', birthDate: '2026-11-03' }))).toEqual([]);
  });

  it('ignora a data quando o modo não é "data"', () => {
    expect(messages(valid({ birthMode: 'unknown', birthDate: 'invalid' }))).toEqual([]);
  });

  it('valida idade aproximada', () => {
    expect(messages(valid({ birthMode: 'age' }))).toContain('ageYears:validation.required');
    expect(messages(valid({ birthMode: 'age', ageYears: '3' }))).toEqual([]);
    expect(messages(valid({ birthMode: 'age', ageMonths: '8' }))).toEqual([]);
    expect(messages(valid({ birthMode: 'age', ageYears: 'x' }))).toContain(
      'ageYears:validation.numberInvalid',
    );
    expect(messages(valid({ birthMode: 'age', ageYears: '31' }))).toContain(
      'ageYears:validation.ageTooHigh',
    );
  });

  it('valida peso', () => {
    expect(messages(valid({ weight: '12,5' }))).toEqual([]);
    expect(messages(valid({ weight: '0' }))).toContain('weight:validation.weightInvalid');
    expect(messages(valid({ weight: '201' }))).toContain('weight:validation.weightInvalid');
    expect(messages(valid({ weight: 'abc' }))).toContain('weight:validation.weightInvalid');
  });

  it('valida microchip ignorando espaços e hífens', () => {
    expect(messages(valid({ microchip: '985 112 345 678 901' }))).toEqual([]);
    expect(messages(valid({ microchip: '123' }))).toContain('microchip:validation.microchipInvalid');
  });

  it('valida a UF (aceita minúsculas, rejeita siglas inexistentes)', () => {
    expect(messages(valid({ naturalUf: 'sp' }))).toEqual([]);
    expect(messages(valid({ naturalUf: 'XX' }))).toContain('naturalUf:validation.ufInvalid');
  });

  it('NÃO bloqueia RGA fora do padrão (só avisa na interface)', () => {
    expect(messages(valid({ rga: 'formato-estranho' }))).toEqual([]);
  });
});

describe('petFormToData', () => {
  it('omite campos vazios e normaliza valores', () => {
    const data = petFormToData(
      valid({
        name: '  Mel ',
        species: 'cat',
        sex: 'female',
        neutered: 'yes',
        weight: '4,2',
        microchip: '985-112-345-678-901',
        rga: ' abc.1d23.c-sp ',
        naturalCity: 'Campinas',
        naturalUf: 'SP',
      }),
      '2026-11-03',
    );
    expect(data).toEqual({
      name: 'Mel',
      species: 'cat',
      sex: 'female',
      neutered: 'yes',
      weightKg: 4.2,
      microchip: '985112345678901',
      rga: 'ABC.1D23.C-SP',
      naturalidade: { cidade: 'Campinas', uf: 'SP' },
    });
    expect(petDataSchema.safeParse(data).success).toBe(true);
  });

  it('não gera chaves undefined (o Firestore não aceita)', () => {
    const data = petFormToData(valid(), '2026-11-03');
    expect(Object.keys(data).sort()).toEqual(['name', 'neutered', 'sex', 'species']);
  });

  it('guarda a idade aproximada com a data do registro', () => {
    const data = petFormToData(valid({ birthMode: 'age', ageYears: '2', ageMonths: '6' }), '2026-11-03');
    expect(data.approxAge).toEqual({ months: 30, recordedOn: '2026-11-03' });
    expect(data.birthDate).toBeUndefined();
  });

  it('guarda a data de nascimento exata', () => {
    const data = petFormToData(valid({ birthMode: 'date', birthDate: '2020-05-10' }), '2026-11-03');
    expect(data.birthDate).toBe('2020-05-10');
    expect(data.approxAge).toBeUndefined();
  });

  it('aceita UF sem cidade', () => {
    const data = petFormToData(valid({ naturalUf: 'RJ' }), '2026-11-03');
    expect(data.naturalidade).toEqual({ uf: 'RJ' });
  });
});

describe('computePetAgeMonths', () => {
  it('calcula pela data de nascimento', () => {
    expect(computePetAgeMonths({ birthDate: '2024-11-03' }, '2026-11-03')).toBe(24);
  });
  it('soma o tempo decorrido à idade aproximada', () => {
    expect(
      computePetAgeMonths({ approxAge: { months: 30, recordedOn: '2025-11-03' } }, '2026-11-03'),
    ).toBe(42);
  });
  it('retorna null sem informação', () => {
    expect(computePetAgeMonths({}, '2026-11-03')).toBeNull();
  });
});

describe('petToFormValues (ida e volta)', () => {
  it('reconstrói o formulário a partir dos dados', () => {
    const values = valid({
      name: 'Rex',
      weight: '12,5',
      birthMode: 'date',
      birthDate: '2020-05-10',
      naturalCity: 'Santos',
      naturalUf: 'SP',
    });
    const roundTrip = petToFormValues(petFormToData(values, '2026-11-03'), '2026-11-03');
    expect(roundTrip).toEqual(values);
  });

  it('mostra a idade aproximada atualizada ao editar', () => {
    const form = petToFormValues(
      { name: 'Luna', species: 'dog', sex: 'female', neutered: 'no', approxAge: { months: 30, recordedOn: '2025-11-03' } },
      '2026-11-03',
    );
    expect(form.birthMode).toBe('age');
    expect(form.ageYears).toBe('3');
    expect(form.ageMonths).toBe('6');
  });
});
