import { describe, expect, it } from 'vitest';
import { normalizeRgaFields, parseBrDate, parsePlace } from './normalize';

const TODAY = '2026-11-03';

describe('parseBrDate / parsePlace', () => {
  it('converte dd/mm/aaaa em ISO e recusa datas impossíveis', () => {
    expect(parseBrDate('15/03/2020')).toBe('2020-03-15');
    expect(parseBrDate('29/02/2024')).toBe('2024-02-29');
    expect(parseBrDate('29/02/2025')).toBeNull();
    expect(parseBrDate('2020-03-15')).toBeNull();
    expect(parseBrDate('')).toBeNull();
  });
  it('separa "Cidade - UF" pela última parte', () => {
    expect(parsePlace('Campinas - SP')).toEqual({ cidade: 'Campinas', uf: 'SP' });
    expect(parsePlace('Rio - Claro - SP')).toEqual({ cidade: 'Rio - Claro', uf: 'SP' });
    expect(parsePlace('campinas - sp')).toEqual({ cidade: 'campinas', uf: 'SP' });
  });
  it('recusa UF inexistente ou texto sem " - "', () => {
    expect(parsePlace('Campinas - XX')).toBeNull();
    expect(parsePlace('Campinas')).toBeNull();
    expect(parsePlace('')).toBeNull();
  });
});

describe('normalizeRgaFields', () => {
  const full = {
    name: 'REX',
    rga: ' abc.1d23.c-sp ',
    microchip: 'Não',
    neutered: 'Sim',
    species: 'Canina',
    birthDate: '15/03/2020',
    cor: 'Caramelo',
    sex: 'Macho',
    naturalidade: 'Campinas - SP',
    tutorName: 'FULANO',
    phone: '(19) 98765-4321',
    local: 'Campinas - SP',
    issuedOn: '01/10/2026',
  };

  it('converte tudo para valores internos (nada em português é guardado)', () => {
    const { fields, confirm, warnings } = normalizeRgaFields(full, TODAY);
    expect(fields).toEqual({
      name: 'REX',
      rga: 'ABC.1D23.C-SP',
      hasMicrochip: false,
      neutered: 'yes',
      species: 'dog',
      sex: 'male',
      birthDate: '2020-03-15',
      cor: 'Caramelo',
      naturalidade: { cidade: 'Campinas', uf: 'SP' },
      issuedPlace: { cidade: 'Campinas', uf: 'SP' },
      issuedOn: '2026-10-01',
      tutor: { nome: 'FULANO', telefone: '19987654321' },
    });
    expect(confirm).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('Felina/Fêmea/Não viram cat/female/no (com acentos e maiúsculas)', () => {
    const { fields } = normalizeRgaFields({ species: 'FELINA', sex: 'Fêmea', neutered: 'NÃO' }, TODAY);
    expect(fields).toMatchObject({ species: 'cat', sex: 'female', neutered: 'no' });
  });

  it('microchip: "Não" = sem chip; outro valor é o número e pede confirmação', () => {
    expect(normalizeRgaFields({ microchip: 'nao' }, TODAY).fields).toMatchObject({ hasMicrochip: false });
    const withChip = normalizeRgaFields({ microchip: '985 112 345 678 901' }, TODAY);
    expect(withChip.fields).toMatchObject({ hasMicrochip: true, microchip: '985112345678901' });
    expect(withChip.confirm).toContain('microchip');
    expect(withChip.warnings).toContain('microchip_confirm');
  });

  it('RGA fora do formato só avisa (não bloqueia nem apaga)', () => {
    const { fields, confirm, warnings } = normalizeRgaFields({ rga: 'formato-novo' }, TODAY);
    expect(fields.rga).toBe('FORMATO-NOVO');
    expect(confirm).toContain('rga');
    expect(warnings).toContain('rga_format');
  });

  it('exige nascimento ≤ emissão ≤ hoje', () => {
    const futureIssue = normalizeRgaFields({ issuedOn: '04/11/2026', birthDate: '15/03/2020' }, TODAY);
    expect(futureIssue.fields.issuedOn).toBeUndefined();
    expect(futureIssue.fields.birthDate).toBe('2020-03-15'); // sem emissão válida, vale o limite de hoje
    expect(futureIssue.warnings).toContain('date_invalid');
    expect(futureIssue.confirm).toContain('issuedOn');

    const birthAfterIssue = normalizeRgaFields({ issuedOn: '01/01/2020', birthDate: '15/03/2020' }, TODAY);
    expect(birthAfterIssue.fields.birthDate).toBeUndefined();
    expect(birthAfterIssue.confirm).toContain('birthDate');

    expect(normalizeRgaFields({ birthDate: '15/03/2030' }, TODAY).fields.birthDate).toBeUndefined();
    expect(normalizeRgaFields({ issuedOn: '03/11/2026' }, TODAY).fields.issuedOn).toBe('2026-11-03'); // hoje vale
  });

  it('telefone: só dígitos, 10 ou 11', () => {
    expect(normalizeRgaFields({ phone: '1932221111' }, TODAY).fields.tutor?.telefone).toBe('1932221111');
    const bad = normalizeRgaFields({ phone: '12345' }, TODAY);
    expect(bad.fields.tutor).toBeUndefined();
    expect(bad.warnings).toContain('phone_invalid');
    expect(bad.confirm).toContain('tutorPhone');
  });

  it('valores fora do esperado viram aviso, não erro', () => {
    const { fields, warnings, confirm } = normalizeRgaFields({ species: 'Equina', sex: '???', neutered: 'talvez' }, TODAY);
    expect(fields.species).toBeUndefined();
    expect(warnings).toContain('value_unrecognized');
    expect(confirm).toEqual(expect.arrayContaining(['species', 'sex', 'neutered']));
  });

  it('PRIVACIDADE: o CPF/CNPJ lido é descartado e não aparece em nenhum lugar do resultado', () => {
    const result = normalizeRgaFields({ ...full, document: '123.456.789-09' }, TODAY);
    const json = JSON.stringify(result);
    expect(json).not.toContain('123.456.789-09');
    expect(json).not.toContain('12345678909');
    expect(Object.keys(result.fields)).not.toContain('document');
  });
});
