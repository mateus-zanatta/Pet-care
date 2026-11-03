import type { HealthEvent, Vaccine } from '@petcare/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import HealthTimelineScreen from '@/app/pet/[id]/health/index';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/features/auth/AuthProvider', () => ({ useUser: () => ({ uid: 'u1', displayName: 'Ana', isAnonymous: false }) }));

let mockRole = 'owner';
jest.mock('@/features/pets/hooks', () => ({
  useMemberships: () => ({ data: [{ petId: 'p1', uid: 'u1', role: mockRole }], loading: false, failed: false }),
  usePet: () => ({ data: { id: 'p1', name: 'Mel', species: 'cat', sex: 'female', neutered: 'yes', ownerId: 'u1', origin: 'manual' }, loading: false, failed: false }),
}));
jest.mock('@/features/medications/hooks', () => ({ useMedications: () => ({ data: [], loading: false, failed: false }) }));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));
const mockExport = jest.fn();
jest.mock('@/features/health/report', () => ({ exportHealthReport: (...a: unknown[]) => mockExport(...a) }));
let mockVaccines: Vaccine[] = [];
let mockEvents: HealthEvent[] = [];
jest.mock('@/features/health/hooks', () => ({
  useVaccines: () => ({ data: mockVaccines, loading: false, failed: false }),
  useHealthEvents: () => ({ data: mockEvents, loading: false, failed: false }),
}));

const vaccine = (id: string, name: string, appliedOn: string, nextDoseOn?: string): Vaccine => ({ id, name, appliedOn, nextDoseOn, createdBy: 'u1' });
const event = (id: string, title: string, date: string, type: HealthEvent['type'] = 'consultation'): HealthEvent => ({ id, title, date, type, createdBy: 'u1' });

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockExport.mockResolvedValue('shared');
  mockRole = 'owner';
  mockVaccines = [];
  mockEvents = [];
});

describe('linha do tempo de saúde', () => {
  it('vazia: explica e oferece registrar vacina ou outro registro', async () => {
    await renderWithProviders(<HealthTimelineScreen />);
    expect(screen.getByText('Nenhum registro de saúde ainda')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar vacina' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pet/[id]/health/vaccine/new', params: { id: 'p1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar consulta, exame ou outro' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pet/[id]/health/event/new', params: { id: 'p1' } });
  });

  it('mistura vacinas e registros, do mais recente ao mais antigo', async () => {
    mockVaccines = [vaccine('v1', 'V10', '2026-03-01')];
    mockEvents = [event('e1', 'Hemograma', '2026-09-01', 'exam'), event('e2', 'Consulta de rotina', '2026-05-01')];
    await renderWithProviders(<HealthTimelineScreen />);
    const ids = screen.getAllByTestId(/^timeline-/).map((n) => n.props.testID);
    expect(ids).toEqual(['timeline-event-e1', 'timeline-event-e2', 'timeline-vaccine-v1']);
    expect(screen.getByText('Exame · 01/09/2026')).toBeTruthy();
    expect(screen.getByText('Vacina · 01/03/2026')).toBeTruthy();
  });

  it('"Próximas datas" lista só o que ainda vai acontecer', async () => {
    mockVaccines = [vaccine('v1', 'V10', '2026-03-01', '2999-01-01'), vaccine('v2', 'Antirrábica', '2020-01-01', '2021-01-01')];
    await renderWithProviders(<HealthTimelineScreen />);
    expect(screen.getByText('Próximas datas')).toBeTruthy();
    expect(screen.getAllByTestId('timeline-vaccine-v1')).toHaveLength(2); // nas próximas datas e no histórico
    expect(screen.getAllByTestId('timeline-vaccine-v2')).toHaveLength(1); // só no histórico
  });

  it('tocar numa linha abre a vacina ou o registro certo', async () => {
    mockVaccines = [vaccine('v1', 'V10', '2026-03-01')];
    mockEvents = [event('e1', 'Hemograma', '2026-09-01', 'exam')];
    await renderWithProviders(<HealthTimelineScreen />);
    await fireEvent.press(screen.getByTestId('timeline-vaccine-v1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pet/[id]/health/vaccine/[vid]', params: { id: 'p1', vid: 'v1' } });
    await fireEvent.press(screen.getByTestId('timeline-event-e1'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/pet/[id]/health/event/[eid]', params: { id: 'p1', eid: 'e1' } });
  });

  it('visualizador vê o histórico, mas não tem botões de registrar', async () => {
    mockRole = 'viewer';
    mockVaccines = [vaccine('v1', 'V10', '2026-03-01')];
    await renderWithProviders(<HealthTimelineScreen />);
    expect(screen.getByTestId('timeline-vaccine-v1')).toBeTruthy();
    expect(screen.getByText('Você só pode visualizar a saúde deste pet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar vacina' })).toBeNull();
  });

  it('deixa claro que o app não faz diagnóstico', async () => {
    await renderWithProviders(<HealthTimelineScreen />);
    expect(screen.getByText(/não dá diagnóstico nem orientação de tratamento/)).toBeTruthy();
  });

  describe('exportar o histórico em PDF', () => {
    it('gera o PDF com o pet e os registros da tela — qualquer membro pode exportar', async () => {
      mockRole = 'viewer';
      mockVaccines = [vaccine('v1', 'V10', '2026-03-01')];
      mockEvents = [event('e1', 'Hemograma', '2026-09-01', 'exam')];
      await renderWithProviders(<HealthTimelineScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Exportar histórico em PDF' }));
      expect(mockExport).toHaveBeenCalledTimes(1);
      const [input] = mockExport.mock.calls[0]!;
      expect(input).toMatchObject({ pet: { name: 'Mel' }, vaccines: mockVaccines, events: mockEvents, locale: 'pt-BR' });
    });

    it('build sem os módulos de PDF: avisa em vez de quebrar', async () => {
      mockExport.mockResolvedValue('unavailable');
      await renderWithProviders(<HealthTimelineScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Exportar histórico em PDF' }));
      expect(await screen.findByText(/Gerar PDF não está disponível nesta versão do app/)).toBeTruthy();
    });

    it('erro ao gerar o PDF aparece na tela', async () => {
      mockExport.mockRejectedValue(new Error('x'));
      await renderWithProviders(<HealthTimelineScreen />);
      await fireEvent.press(screen.getByRole('button', { name: 'Exportar histórico em PDF' }));
      expect(await screen.findByText('Não foi possível gerar o PDF. Tente de novo.')).toBeTruthy();
    });
  });
});
