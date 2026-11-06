import { describe, expect, it } from 'vitest';
import {
  DAILY_LIMITS,
  adoptionInputSchema,
  adoptionPoint,
  isOwnPhotoPath,
  isWildRescue,
  loginDelayMs,
  loginWaitRemainingMs,
  passwordScore,
  recordLoginFailure,
  reportInputSchema,
  rescueAlertInputSchema,
  rescueAuthority,
  unmetPasswordRules,
} from './index';

const adoption = {
  species: 'dog',
  sex: 'female',
  ageGroup: 'adult',
  colors: ['caramelo'],
  neutered: 'yes',
  vaccines: [{ name: 'V10', date: '2026-05-10' }],
  medications: [],
  exams: [{ name: 'Teste de leishmaniose', note: 'negativo' }],
  description: 'Muito dócil, se dá bem com crianças.',
  city: 'Campinas',
  uf: 'SP',
  contactPhone: '(19) 99999-0000',
};

describe('adoção', () => {
  it('aceita um anúncio completo e limpa textos vazios', () => {
    const parsed = adoptionInputSchema.parse({ ...adoption, name: '  ', breed: '' });
    expect(parsed.name).toBeUndefined();
    expect(parsed.breed).toBeUndefined();
    expect(parsed.vaccines[0]!.name).toBe('V10');
  });

  it('exige cor, contato, descrição e UF válida', () => {
    const r = adoptionInputSchema.safeParse({ ...adoption, colors: [], contactPhone: '', description: 'curta', uf: 'XX' });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(['colors', 'contactPhone', 'description', 'uf']));
  });

  it('PRIVACIDADE: a coordenada do anúncio vira a célula de ~1 km', () => {
    expect(adoptionPoint({ lat: -22.907123, lng: -47.062987 })).toEqual({ lat: -22.91, lng: -47.06 });
    expect(adoptionPoint({})).toBeUndefined();
  });
});

describe('resgate', () => {
  const alert = { animalKind: 'wild_bird', conditions: ['injured'], count: 1, description: 'Coruja caída com a asa machucada', lat: -23.5, lng: -46.6 };

  it('aceita qualquer animal, inclusive silvestre, com ponto exato', () => {
    expect(rescueAlertInputSchema.parse(alert).lat).toBe(-23.5);
  });

  it('pede pelo menos uma condição', () => {
    expect(rescueAlertInputSchema.safeParse({ ...alert, conditions: [] }).success).toBe(false);
  });

  it('silvestre/marinho vai para o órgão ambiental; cavalo e gado têm contato próprio', () => {
    expect(isWildRescue('wild_bird')).toBe(true);
    expect(rescueAuthority('marine')).toBe('environmental');
    expect(rescueAuthority('horse')).toBe('livestock');
    expect(rescueAuthority('cat')).toBe('domestic');
  });
});

describe('denúncia', () => {
  const report = { type: 'neglect', description: 'Cachorro sem água e comida há dias no quintal.', ongoing: true, lat: -23.5, lng: -46.6, anonymous: true };

  it('aceita denúncia anônima, trata data vazia como "não informada" e recusa data no futuro', () => {
    expect(reportInputSchema.parse(report).anonymous).toBe(true);
    expect(reportInputSchema.parse({ ...report, occurredOn: '' }).occurredOn).toBeUndefined();
    expect(reportInputSchema.safeParse({ ...report, occurredOn: 'invalid' }).success).toBe(false);
    const future = reportInputSchema.safeParse({ ...report, occurredOn: '2999-01-01' });
    expect(future.success).toBe(false);
  });

  it('descrição precisa de detalhe (20+ caracteres)', () => {
    expect(reportInputSchema.safeParse({ ...report, description: 'maus tratos' }).success).toBe(false);
  });

  it('limites diários existem para as três centrais', () => {
    expect(DAILY_LIMITS).toEqual({ adoption: 5, rescue: 10, report: 5 });
  });
});

describe('fotos das centrais', () => {
  it('só aceita fotos .jpg dentro da pasta do próprio registro', () => {
    expect(isOwnPhotoPath('adoption', 'abc', 'adoptions/abc/photo-1.jpg')).toBe(true);
    expect(isOwnPhotoPath('adoption', 'abc', 'adoptions/xyz/photo-1.jpg')).toBe(false);
    expect(isOwnPhotoPath('report', 'abc', 'reports/abc/../../pets/x.jpg')).toBe(false);
    expect(isOwnPhotoPath('rescue', 'abc', 'rescues/abc/photo.png')).toBe(false);
  });
});

describe('senha forte', () => {
  it('senha forte de verdade passa em tudo', () => {
    expect(unmetPasswordRules('Girassol#Azul42')).toEqual([]);
    expect(passwordScore('Girassol#Azul42')).toBe(4);
  });

  it('aponta exatamente o que falta', () => {
    expect(unmetPasswordRules('abc')).toEqual(expect.arrayContaining(['length', 'upper', 'digit', 'symbol']));
    expect(unmetPasswordRules('Aaaa1234567!')).toContain('noRepeat');
  });

  it('recusa senhas batidas, mesmo "enfeitadas", e dados pessoais', () => {
    expect(unmetPasswordRules('Senha@2024!')).toContain('notCommon');
    expect(unmetPasswordRules('Mariana#2026x', { name: 'Mariana Souza' })).toContain('notPersonal');
    expect(unmetPasswordRules('Joao.silva#99', { email: 'joao.silva@email.com' })).toContain('notPersonal');
    expect(passwordScore('Senha@2024!')).toBe(1);
  });
});

describe('espera crescente no login', () => {
  it('2 erros de graça; depois dobra a cada erro, até 15 min', () => {
    expect([1, 2, 3, 4, 5, 6].map(loginDelayMs)).toEqual([0, 0, 2000, 4000, 8000, 16000]);
    expect(loginDelayMs(30)).toBe(15 * 60_000);
  });

  it('conta os erros, calcula quanto falta e zera depois de 24 h sem erro', () => {
    let s = recordLoginFailure(null, 0);
    s = recordLoginFailure(s, 1000);
    s = recordLoginFailure(s, 2000); // 3º erro: espera 2 s
    expect(s.failures).toBe(3);
    expect(loginWaitRemainingMs(s, 2500)).toBe(1500);
    expect(loginWaitRemainingMs(s, 4000)).toBe(0);
    const later = recordLoginFailure(s, 2000 + 25 * 60 * 60_000);
    expect(later.failures).toBe(1);
  });
});
