import type { Medication } from '@petcare/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import MedicationsScreen from '@/app/pet/[id]/medications/index';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockPush = jest.fn();
const mockRequest = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1' }),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/core/time/useNow', () => ({ useNow: () => new Date(2026, 10, 4, 15, 0, 0) }));
jest.mock('@/features/auth/AuthProvider', () => ({ useUser: () => ({ uid: 'u1', displayName: 'Ana', isAnonymous: false }) }));

let mockRole = 'owner';
jest.mock('@/features/pets/hooks', () => ({
  useMemberships: () => ({ data: [{ petId: 'p1', uid: 'u1', role: mockRole }], loading: false, failed: false }),
}));
let mockMeds: Medication[] = [];
jest.mock('@/features/medications/hooks', () => ({
  useMedications: () => ({ data: mockMeds, loading: false, failed: false }),
}));
let mockPermission: string | null = 'granted';
jest.mock('@/features/reminders/usePermission', () => ({
  useReminderPermission: () => ({ state: mockPermission, request: mockRequest }),
}));

const med = (id: string, name: string, over: Partial<Medication> = {}): Medication => ({
  id,
  name,
  dose: { amount: '1', unit: 'comprimido', route: 'oral' },
  frequency: { kind: 'interval', everyHours: 12 },
  startDate: '2026-11-04',
  startTime: '08:00',
  status: 'active',
  createdBy: 'u1',
  ...over,
});

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'owner';
  mockMeds = [];
  mockPermission = 'granted';
});

describe('lista de medicamentos', () => {
  it('vazia: explica e oferece adicionar', async () => {
    await renderWithProviders(<MedicationsScreen />);
    expect(screen.getByText('Nenhum medicamento registrado')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Registrar medicação' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pet/[id]/medications/new', params: { id: 'p1' } });
  });

  it('agrupa por situação: em uso, suspensos e concluídos, mostrando dose e próxima dose', async () => {
    mockMeds = [med('a', 'Antibiótico'), med('b', 'Pomada', { status: 'suspended' }), med('c', 'Vermífugo', { status: 'completed' })];
    await renderWithProviders(<MedicationsScreen />);
    expect(screen.getByText('Em uso')).toBeTruthy();
    expect(screen.getByText('Suspensos')).toBeTruthy();
    expect(screen.getByText('Concluídos')).toBeTruthy();
    expect(screen.getAllByText('1 comprimido · A cada 12 h')).toHaveLength(3);
    expect(screen.getByText('Próxima dose: hoje às 20:00')).toBeTruthy();
  });

  it('tocar no cartão abre o detalhe', async () => {
    mockMeds = [med('a', 'Antibiótico')];
    await renderWithProviders(<MedicationsScreen />);
    await fireEvent.press(screen.getByTestId('medication-a'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pet/[id]/medications/[medId]', params: { id: 'p1', medId: 'a' } });
  });

  it('sem permissão de notificação: avisa e oferece pedir', async () => {
    mockMeds = [med('a', 'Antibiótico')];
    mockPermission = 'undetermined';
    await renderWithProviders(<MedicationsScreen />);
    expect(screen.getByText(/Ative as notificações para receber os lembretes/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Permitir notificações' }));
    expect(mockRequest).toHaveBeenCalled();
  });

  it('permissão negada de vez: oferece abrir as configurações do aparelho', async () => {
    mockMeds = [med('a', 'Antibiótico')];
    mockPermission = 'denied';
    await renderWithProviders(<MedicationsScreen />);
    expect(screen.getByRole('button', { name: 'Abrir configurações' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Permitir notificações' })).toBeNull();
  });

  it('visualizador só vê: sem botão de adicionar e sem aviso de permissão', async () => {
    mockRole = 'viewer';
    mockMeds = [med('a', 'Antibiótico')];
    mockPermission = 'denied';
    await renderWithProviders(<MedicationsScreen />);
    expect(screen.getByText('Você só pode visualizar os medicamentos deste pet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar medicação' })).toBeNull();
    expect(screen.queryByText(/Ative as notificações/)).toBeNull();
  });
});
