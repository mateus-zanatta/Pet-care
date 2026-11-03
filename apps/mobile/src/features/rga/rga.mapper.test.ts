import { PET_FORM_DEFAULTS, type RgaImportResult } from '@petcare/shared';
import { diffFormValues, mergePlaceChanges } from './rga.diff';
import { rgaResultToPrefill } from './rga.mapper';

const NOW = '2026-11-03T12:00:00.000Z';

const recognized: RgaImportResult = {
  mode: 'pdf',
  recognized: true,
  creator: 'JasperReports Library version 6.20.0',
  fields: {
    name: 'REX DE TESTE',
    rga: 'ABC.1D23.C-SP',
    hasMicrochip: false,
    neutered: 'yes',
    species: 'dog',
    sex: 'male',
    birthDate: '2020-03-15',
    cor: 'Caramelo',
    naturalidade: { cidade: 'Campinas', uf: 'SP' },
    issuedOn: '2026-10-01',
    tutor: { nome: 'FULANO DE TAL', telefone: '19987654321' },
  },
  confirm: [],
  warnings: [],
  qr: { found: true, rga: 'ABC.1D23.C-SP', matches: true },
};

describe('rgaResultToPrefill', () => {
  it('preenche o formulário com enums internos e marca tudo como "lido do RG"', () => {
    const prefill = rgaResultToPrefill(recognized, NOW);
    expect(prefill.values).toMatchObject({
      name: 'REX DE TESTE',
      rga: 'ABC.1D23.C-SP',
      species: 'dog',
      sex: 'male',
      neutered: 'yes',
      cor: 'Caramelo',
      birthMode: 'date',
      birthDate: '2020-03-15',
      naturalCity: 'Campinas',
      naturalUf: 'SP',
    });
    expect(prefill.badges).toMatchObject({ name: 'rga', rga: 'rga', species: 'rga', birthDate: 'rga', naturalUf: 'rga' });
    expect(Object.values(prefill.badges).every((b) => b === 'rga')).toBe(true);
  });

  it('guarda o responsável à parte (só é salvo com confirmação) e nunca preenche campos do pet com ele', () => {
    const prefill = rgaResultToPrefill(recognized, NOW);
    expect(prefill.tutor).toEqual({ nome: 'FULANO DE TAL', telefone: '19987654321' });
    expect(JSON.stringify(prefill.values)).not.toContain('FULANO');
    expect(JSON.stringify(prefill.values)).not.toContain('19987654321');
  });

  it('monta os metadados do SinPatinhas (origem, emissão, conferência do QR)', () => {
    expect(rgaResultToPrefill(recognized, NOW).sinpatinhas).toEqual({
      emitidoEm: '2026-10-01',
      importadoEm: NOW,
      origem: 'pdf',
      qrConfere: true,
    });
    expect(
      rgaResultToPrefill({ ...recognized, qr: { found: true, rga: 'ZZZ.9999.Z-RJ', matches: false } }, NOW).sinpatinhas.qrConfere,
    ).toBe(false);
  });

  it('"confira" vence "lido do RG", inclusive em campos que foram descartados', () => {
    const prefill = rgaResultToPrefill(
      {
        ...recognized,
        fields: { ...recognized.fields, birthDate: undefined, microchip: '985112345678901' },
        confirm: ['microchip', 'birthDate'],
        warnings: ['microchip_confirm', 'date_invalid'],
      },
      NOW,
    );
    expect(prefill.badges.microchip).toBe('check');
    expect(prefill.badges.birthDate).toBe('check'); // a data não veio, mas fica avisado
    expect(prefill.values.microchip).toBe('985112345678901');
    expect(prefill.values.birthDate).toBe('');
    expect(prefill.badges.name).toBe('rga');
  });

  it('só imagem com QR: preenche apenas o RGA e o resto fica manual', () => {
    const prefill = rgaResultToPrefill(
      { mode: 'qr', recognized: true, fields: { rga: 'ABC.1D23.C-SP' }, confirm: [], warnings: [], qr: { found: true, rga: 'ABC.1D23.C-SP' } },
      NOW,
    );
    expect(prefill.values).toEqual({ ...PET_FORM_DEFAULTS, rga: 'ABC.1D23.C-SP' });
    expect(prefill.filled).toEqual(['rga']);
    expect(prefill.sinpatinhas).toEqual({ importadoEm: NOW, origem: 'qr' });
  });

  it('ao atualizar um pet, o que o RG não traz continua como estava', () => {
    const existing = { ...PET_FORM_DEFAULTS, name: 'Rex', weight: '12,5', notes: 'toma remédio', species: 'dog' as const };
    const prefill = rgaResultToPrefill({ ...recognized, fields: { rga: 'ABC.1D23.C-SP', cor: 'Preto' } }, NOW, existing);
    expect(prefill.values).toMatchObject({ name: 'Rex', weight: '12,5', notes: 'toma remédio', cor: 'Preto' });
  });
});

describe('diffFormValues', () => {
  const before = { ...PET_FORM_DEFAULTS, name: 'Rex', species: 'dog' as const, cor: 'Preto', rga: 'ABC.1D23.C-SP' };

  it('lista só o que mudaria, entre os campos que o RG preencheu', () => {
    const after = { ...before, name: 'REX DE TESTE', cor: 'Caramelo' };
    const changes = diffFormValues(before, after, ['name', 'cor', 'rga']);
    expect(changes).toEqual([
      { field: 'name', before: 'Rex', after: 'REX DE TESTE' },
      { field: 'cor', before: 'Preto', after: 'Caramelo' },
    ]);
  });

  it('não acusa mudança em campos que o RG não preencheu', () => {
    const after = { ...before, notes: 'mudou por outro motivo' };
    expect(diffFormValues(before, after, ['name', 'rga'])).toEqual([]);
  });

  it('une cidade e UF numa linha só', () => {
    const merged = mergePlaceChanges([
      { field: 'naturalCity', before: 'Santos', after: 'Campinas' },
      { field: 'naturalUf', before: 'SP', after: 'SP' },
      { field: 'name', before: 'A', after: 'B' },
    ]);
    expect(merged).toEqual([
      { field: 'name', before: 'A', after: 'B' },
      { field: 'naturalCity', before: 'Santos - SP', after: 'Campinas - SP' },
    ]);
  });
});
