import type { HealthEvent, Vaccine } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import EventDetailScreen from '@/app/pet/[id]/health/event/[eid]/index';
import VaccineDetailScreen from '@/app/pet/[id]/health/vaccine/[vid]/index';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1', vid: 'v1', eid: 'e1' }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
  Stack: { Screen: () => null },
}));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));
jest.mock('@/features/auth/AuthProvider', () => ({ useUser: () => ({ uid: 'u1', displayName: 'Ana', isAnonymous: false }) }));

let mockRole = 'owner';
jest.mock('@/features/pets/hooks', () => ({
  useMemberships: () => ({ data: [{ petId: 'p1', uid: 'u1', role: mockRole }], loading: false, failed: false }),
}));
let mockVaccine: Vaccine | undefined;
let mockEvent: HealthEvent | undefined;
jest.mock('@/features/health/hooks', () => ({
  useVaccines: () => ({ data: mockVaccine ? [mockVaccine] : [], loading: false, failed: false }),
  useHealthEvents: () => ({ data: mockEvent ? [mockEvent] : [], loading: false, failed: false }),
}));
const mockDeleteVaccine = jest.fn();
const mockDeleteEvent = jest.fn();
jest.mock('@/features/health/health.repo', () => ({
  deleteVaccine: (...a: unknown[]) => mockDeleteVaccine(...a),
  deleteHealthEvent: (...a: unknown[]) => mockDeleteEvent(...a),
}));
const mockDeleteFiles = jest.fn();
jest.mock('@/features/attachments/attachments.service', () => ({
  AttachmentError: class extends Error {},
  addAttachment: jest.fn(),
  removeAttachment: jest.fn(),
  openAttachment: jest.fn(),
  pickPdf: jest.fn(),
  deleteAllAttachmentFiles: (...a: unknown[]) => mockDeleteFiles(...a),
}));
jest.mock('@/features/pets/usePhotoPicker', () => ({ PermissionDeniedError: class extends Error {}, pickFromGallery: jest.fn(), takePhoto: jest.fn() }));

const att = { id: 'a1', path: 'pets/p1/attachments/v1/a1.pdf', name: 'laudo.pdf', contentType: 'application/pdf' as const, size: 2048, addedAt: '2026-11-04T10:00:00.000Z' };

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'owner';
  mockVaccine = { id: 'v1', name: 'V10', appliedOn: '2026-10-01', nextDoseOn: '2027-10-01', batch: 'L9', vet: { name: 'Dra. Ana', crmvNumber: '123', crmvUf: 'SP' }, clinic: 'Clínica X', attachments: [att], createdBy: 'u1' };
  mockEvent = { id: 'e1', type: 'exam', title: 'Hemograma', date: '2026-10-01', description: 'Tudo certo', nextDate: '2027-01-01', attachments: [att], createdBy: 'u1' };
  mockDeleteVaccine.mockResolvedValue(undefined);
  mockDeleteEvent.mockResolvedValue(undefined);
  mockDeleteFiles.mockResolvedValue(undefined);
});

const confirmDelete = async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
  const destructive = alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!;
  await destructive.onPress!();
};

describe('detalhe da vacina', () => {
  it('mostra os dados, o veterinário com CRMV e os anexos', async () => {
    await renderWithProviders(<VaccineDetailScreen />);
    expect(screen.getByText('V10')).toBeTruthy();
    expect(screen.getByText('Aplicada em 01/10/2026')).toBeTruthy();
    expect(screen.getByText('01/10/2027')).toBeTruthy();
    expect(screen.getByText('Dra. Ana · CRMV 123/SP')).toBeTruthy();
    expect(screen.getByText('laudo.pdf')).toBeTruthy();
  });

  it('excluir pede confirmação, apaga os arquivos ANTES do registro e volta', async () => {
    await renderWithProviders(<VaccineDetailScreen />);
    await confirmDelete();
    await waitFor(() => expect(mockDeleteVaccine).toHaveBeenCalledWith('p1', 'v1'));
    expect(mockDeleteFiles).toHaveBeenCalledWith([att]);
    expect(mockDeleteFiles.mock.invocationCallOrder[0]).toBeLessThan(mockDeleteVaccine.mock.invocationCallOrder[0]!);
    expect(mockBack).toHaveBeenCalled();
  });

  it('se a exclusão falhar, mostra o erro e não volta', async () => {
    mockDeleteVaccine.mockRejectedValue(new Error('x'));
    await renderWithProviders(<VaccineDetailScreen />);
    await confirmDelete();
    expect(await screen.findByText('Não foi possível excluir a vacina.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('visualizador não edita nem exclui', async () => {
    mockRole = 'viewer';
    await renderWithProviders(<VaccineDetailScreen />);
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
    expect(screen.getByText('laudo.pdf')).toBeTruthy();
  });

  it('vacina que não existe mais mostra aviso', async () => {
    mockVaccine = undefined;
    await renderWithProviders(<VaccineDetailScreen />);
    expect(screen.getByText('Vacina não encontrada.')).toBeTruthy();
  });
});

describe('detalhe do registro de saúde', () => {
  it('mostra tipo, data, descrição e próxima data', async () => {
    await renderWithProviders(<EventDetailScreen />);
    expect(screen.getByText('Exame · 01/10/2026')).toBeTruthy();
    expect(screen.getByText('Tudo certo')).toBeTruthy();
    expect(screen.getByText('01/01/2027')).toBeTruthy();
  });

  it('excluir apaga os arquivos antes e depois o registro', async () => {
    await renderWithProviders(<EventDetailScreen />);
    await confirmDelete();
    await waitFor(() => expect(mockDeleteEvent).toHaveBeenCalledWith('p1', 'e1'));
    expect(mockDeleteFiles).toHaveBeenCalledWith([att]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('editar abre a tela de edição certa', async () => {
    await renderWithProviders(<EventDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pet/[id]/health/event/[eid]/edit', params: { id: 'p1', eid: 'e1' } });
  });
});
