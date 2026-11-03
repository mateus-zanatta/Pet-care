import type { HealthEvent, Medication, Pet, Vaccine } from '@petcare/shared';
import i18n from 'i18next';
import { setupTestI18n } from '@/test/render';
import { buildHealthReportHtml, escapeHtml, exportHealthReport, isPdfExportAvailable, type ReportInput } from './report';

const mockPrint = jest.fn();
const mockShare = jest.fn();
const mockSharingAvailable = jest.fn();
jest.mock('expo-print', () => ({ printToFileAsync: (...a: unknown[]) => mockPrint(...a) }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockSharingAvailable(),
  shareAsync: (...a: unknown[]) => mockShare(...a),
}));

const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key as never, options as never));

const pet: Pet = {
  id: 'p1',
  ownerId: 'u1',
  origin: 'manual',
  name: 'Mel',
  species: 'cat',
  sex: 'female',
  neutered: 'yes',
  breed: 'SRD',
  birthDate: '2020-03-15',
  weightKg: 4.2,
  microchip: '985112345678901',
  rga: 'ABC.1D23.C-SP',
  allergies: 'Dipirona',
  notes: 'Come pouco',
  // Dados que NUNCA devem sair no PDF:
  tutor: { nome: 'FULANO DE TAL', telefone: '19987654321' },
  address: { text: 'Rua Secreta, 123' },
  photoPath: 'pets/p1/profile.jpg',
};

const med: Medication = {
  id: 'm1',
  name: 'Amoxicilina',
  dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
  frequency: { kind: 'interval', everyHours: 8 },
  startDate: '2026-11-01',
  endDate: '2026-11-08',
  status: 'active',
  vet: { name: 'Dra. Ana', crmvNumber: '12345', crmvUf: 'SP' },
  notes: 'Dar com comida',
  createdBy: 'u1',
};
const vaccine: Vaccine = { id: 'v1', name: 'V10', appliedOn: '2026-03-01', nextDoseOn: '2027-03-01', batch: 'L9', clinic: 'Clínica X', createdBy: 'u1' };
const event: HealthEvent = {
  id: 'e1',
  type: 'exam',
  title: 'Hemograma',
  date: '2026-09-01',
  description: 'Sem alterações',
  nextDate: '2027-03-01',
  attachments: [{ id: 'a1', path: 'p', name: 'laudo-secreto.pdf', contentType: 'application/pdf', size: 1, addedAt: '2026-09-01T10:00:00.000Z' }],
  createdBy: 'u1',
};

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  pet, medications: [med], vaccines: [vaccine], events: [event], generatedOn: '2026-11-04', locale: 'pt-BR', ...over,
});

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockPrint.mockResolvedValue({ uri: 'file:///cache/report.pdf' });
  mockShare.mockResolvedValue(undefined);
  mockSharingAvailable.mockResolvedValue(true);
});

describe('escapeHtml', () => {
  it('escapa os cinco caracteres perigosos', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
});

describe('buildHealthReportHtml', () => {
  it('traz os dados do animal, os medicamentos "como prescritos", as vacinas e a linha do tempo', async () => {
    const html = buildHealthReportHtml(input(), t);
    expect(html).toContain('Histórico de saúde: Mel');
    expect(html).toContain('Gerado em 04/11/2026');
    for (const text of ['Gato', 'SRD', 'Fêmea', '985112345678901', 'ABC.1D23.C-SP', 'Dipirona', '4,2 kg', '15/03/2020']) expect(html).toContain(text);
    expect(html).toContain('1/2 comprimido · Oral (pela boca)');
    expect(html).toContain('A cada 8 h');
    expect(html).toContain('Dra. Ana · CRMV 12345/SP');
    expect(html).toContain('V10');
    expect(html).toContain('01/03/2027');
    expect(html).toContain('Hemograma');
    expect(html).toContain('Exame');
    expect(html).toContain('1 anexo(s) no app');
  });

  it('NÃO leva dados do tutor, endereço, foto nem o conteúdo/nome dos anexos', () => {
    const html = buildHealthReportHtml(input(), t);
    for (const secret of ['FULANO DE TAL', '19987654321', 'Rua Secreta', 'profile.jpg', 'laudo-secreto']) expect(html).not.toContain(secret);
  });

  it('escapa TODO texto digitado (nada vira marcação no PDF)', () => {
    const evil = '<script>alert(1)</script>';
    const html = buildHealthReportHtml(
      input({
        pet: { ...pet, name: evil, notes: '"><img src=x onerror=alert(1)>' },
        medications: [{ ...med, name: 'A & B <b>', notes: evil }],
        vaccines: [{ ...vaccine, name: evil, clinic: '<i>x</i>' }],
        events: [{ ...event, title: evil, description: '</td><script>' }],
      }),
      t,
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A &amp; B &lt;b&gt;');
  });

  it('sem registros: mostra os avisos de vazio em vez de tabelas vazias', () => {
    const html = buildHealthReportHtml(input({ medications: [], vaccines: [], events: [] }), t);
    expect(html).toContain('Nenhum medicamento registrado.');
    expect(html).toContain('Nenhuma vacina registrada.');
    expect(html).toContain('Nenhum registro de saúde.');
    expect(html).not.toContain('<table');
  });

  it('medicamentos em uso vêm antes dos concluídos', () => {
    const html = buildHealthReportHtml(input({ medications: [{ ...med, id: 'm2', name: 'AAA Concluído', status: 'completed' }, med] }), t);
    expect(html.indexOf('Amoxicilina')).toBeLessThan(html.indexOf('AAA Concluído'));
  });

  it('em inglês usa os rótulos e as datas em inglês', async () => {
    await setupTestI18n('en');
    const html = buildHealthReportHtml(input({ locale: 'en' }), t);
    expect(html).toContain('lang="en"');
    expect(html).toContain('Health history: Mel');
    expect(html).toContain('Vaccines');
    expect(html).toContain('Oral (by mouth)');
    expect(html).toContain('4.2 kg');
    await setupTestI18n('pt-BR');
  });
});

describe('exportHealthReport', () => {
  it('gera o PDF a partir do HTML e abre o compartilhamento como PDF', async () => {
    expect(isPdfExportAvailable()).toBe(true);
    await expect(exportHealthReport(input(), t)).resolves.toBe('shared');
    expect(mockPrint).toHaveBeenCalledWith({ html: expect.stringContaining('Histórico de saúde: Mel') });
    expect(mockShare).toHaveBeenCalledWith('file:///cache/report.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
  });

  it('se o aparelho não puder compartilhar, avisa em vez de falhar', async () => {
    mockSharingAvailable.mockResolvedValue(false);
    await expect(exportHealthReport(input(), t)).resolves.toBe('unavailable');
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('erro ao gerar o PDF chega à tela', async () => {
    mockPrint.mockRejectedValue(new Error('print failed'));
    await expect(exportHealthReport(input(), t)).rejects.toThrow('print failed');
  });
});
