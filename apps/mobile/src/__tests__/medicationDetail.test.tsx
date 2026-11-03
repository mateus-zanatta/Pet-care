import type { DoseLog, Medication } from '@petcare/shared';
import { doseLogId } from '@petcare/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';
import MedicationDetailScreen from '@/app/pet/[id]/medications/[medId]/index';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockNow = new Date(2026, 10, 4, 15, 0, 0); // 04/11/2026 15:00 (relógio local)
const at = (h: number, m = 0) => new Date(2026, 10, 4, h, m, 0);

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1', medId: 'm1' }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
  Stack: { Screen: () => null },
}));
jest.mock('@/core/time/useNow', () => ({ useNow: () => mockNow }));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));
jest.mock('@/features/auth/AuthProvider', () => ({
  useUser: () => ({ uid: 'u1', displayName: 'Ana', isAnonymous: false }),
}));

let mockRole = 'owner';
jest.mock('@/features/pets/hooks', () => ({
  useMemberships: () => ({ data: [{ petId: 'p1', uid: 'u1', role: mockRole }], loading: false, failed: false }),
}));

let mockMed: Medication;
let mockLogs: DoseLog[] = [];
jest.mock('@/features/medications/hooks', () => ({
  useMedications: () => ({ data: [mockMed], loading: false, failed: false }),
  useDoseLogs: () => ({ data: mockLogs, loading: false, failed: false }),
}));

jest.mock('@/features/attachments/attachments.service', () => ({
  AttachmentError: class extends Error {},
  addAttachment: jest.fn(),
  removeAttachment: jest.fn(),
  openAttachment: jest.fn(),
  pickPdf: jest.fn(),
  deleteAllAttachmentFiles: jest.fn(async () => undefined),
}));
jest.mock('@/features/pets/usePhotoPicker', () => ({ PermissionDeniedError: class extends Error {}, pickFromGallery: jest.fn(), takePhoto: jest.fn() }));

const mockLogDose = jest.fn();
const mockUndo = jest.fn();
const mockSetStatus = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/features/medications/medications.repo', () => ({
  logDose: (...args: unknown[]) => mockLogDose(...args),
  undoDose: (...args: unknown[]) => mockUndo(...args),
  setMedicationStatus: (...args: unknown[]) => mockSetStatus(...args),
  deleteMedication: (...args: unknown[]) => mockDelete(...args),
}));

const medication = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1',
  name: 'Amoxicilina',
  dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
  frequency: { kind: 'interval', everyHours: 8 },
  startDate: '2026-11-04',
  startTime: '06:00',
  status: 'active',
  place: { kind: 'home' },
  createdBy: 'u1',
  ...over,
});

const log = (scheduled: Date, outcome: DoseLog['outcome'], byName = 'Bia'): DoseLog => ({
  id: doseLogId('m1', scheduled),
  medicationId: 'm1',
  scheduledFor: scheduled.toISOString(),
  outcome,
  actualAt: new Date(scheduled.getTime() + 7 * 60_000).toISOString(),
  byUid: 'u2',
  byName,
});

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'owner';
  mockMed = medication();
  mockLogs = [];
  mockLogDose.mockResolvedValue({ id: 'x', status: 'committed' });
  mockUndo.mockResolvedValue(undefined);
  mockSetStatus.mockResolvedValue('committed');
  mockDelete.mockResolvedValue(undefined);
});

describe('detalhe do medicamento', () => {
  it('mostra a dose "como prescrita", a via, a frequência e a próxima dose', async () => {
    await renderWithProviders(<MedicationDetailScreen />);
    expect(screen.getAllByText('1/2 comprimido').length).toBeGreaterThanOrEqual(1); // ficha e doses pendentes
    expect(screen.getByText('Oral (pela boca)')).toBeTruthy();
    expect(screen.getByText('A cada 8 h')).toBeTruthy();
    expect(screen.getByText('hoje às 22:00')).toBeTruthy(); // 06:00, 14:00 já passaram; a próxima é 22:00
  });

  it('lista as doses atrasadas e "Dei a dose" registra a dose AGENDADA, com quem deu', async () => {
    await renderWithProviders(<MedicationDetailScreen />);
    expect(screen.getByText('Dose das 06:00')).toBeTruthy();
    expect(screen.getByText('Dose das 14:00')).toBeTruthy();

    const give = screen.getAllByRole('button', { name: 'Dei a dose' });
    await fireEvent.press(give[0]!);
    await waitFor(() => expect(mockLogDose).toHaveBeenCalledTimes(1));
    expect(mockLogDose).toHaveBeenCalledWith({
      petId: 'p1', medicationId: 'm1', scheduledFor: at(6), outcome: 'given', uid: 'u1', displayName: 'Ana',
    });
  });

  it('"Pulei" registra como pulada', async () => {
    await renderWithProviders(<MedicationDetailScreen />);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Pulei' })[1]!);
    await waitFor(() => expect(mockLogDose).toHaveBeenCalledWith(expect.objectContaining({ scheduledFor: at(14), outcome: 'skipped' })));
  });

  it('dose já registrada some da lista de pendentes e aparece no histórico, com quem deu', async () => {
    mockLogs = [log(at(6), 'given', 'Bia')];
    await renderWithProviders(<MedicationDetailScreen />);
    expect(screen.queryByText('Dose das 06:00')).toBeNull();
    expect(screen.getByText('Dose das 14:00')).toBeTruthy();
    expect(screen.getByText(/Dada às 06:07 · por Bia/)).toBeTruthy();
  });

  it('desfazer um registro chama a exclusão do registro certo', async () => {
    const entry = log(at(6), 'skipped');
    mockLogs = [entry];
    await renderWithProviders(<MedicationDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(mockUndo).toHaveBeenCalledWith('p1', entry.id));
  });

  it('se o servidor não confirmar, avisa que ficou só no aparelho', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockLogDose.mockResolvedValue({ id: 'x', status: 'pending' });
    await renderWithProviders(<MedicationDetailScreen />);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dei a dose' })[0]!);
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringContaining('Registrada neste aparelho')));
  });

  it('se o registro for recusado, mostra o erro (nada de falha silenciosa)', async () => {
    mockLogDose.mockRejectedValue(Object.assign(new Error('x'), { code: 'firestore/permission-denied' }));
    await renderWithProviders(<MedicationDetailScreen />);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Dei a dose' })[0]!);
    expect(await screen.findByText('Não foi possível registrar a dose. Tente de novo.')).toBeTruthy();
  });

  it('visualizador vê tudo, mas não tem botões de registrar, editar nem excluir', async () => {
    mockRole = 'viewer';
    mockLogs = [log(at(6), 'given')];
    await renderWithProviders(<MedicationDetailScreen />);
    expect(screen.getByText('1/2 comprimido')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dei a dose' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
  });

  it('concluir, suspender e voltar a usar mudam só a situação', async () => {
    await renderWithProviders(<MedicationDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar como concluído' }));
    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('p1', 'm1', 'completed'));
    await fireEvent.press(screen.getByRole('button', { name: 'Suspender' }));
    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('p1', 'm1', 'suspended'));
  });

  it('suspenso não lista doses para registrar e oferece "Voltar a usar"', async () => {
    mockMed = medication({ status: 'suspended' });
    await renderWithProviders(<MedicationDetailScreen />);
    expect(screen.queryByRole('button', { name: 'Dei a dose' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Voltar a usar' })).toBeTruthy();
  });

  it('avisa quando o tratamento já devia ter terminado e quando o medicamento venceu', async () => {
    mockMed = medication({ endDate: '2026-11-01', startDate: '2026-10-25', expiresOn: '2026-10-30' });
    await renderWithProviders(<MedicationDetailScreen />);
    expect(screen.getByText(/O tratamento terminou em .*Marque como concluído/)).toBeTruthy();
    expect(screen.getByText(/Vencido em .*Não use e fale com o veterinário/)).toBeTruthy();
  });

  it('excluir pede confirmação e só então apaga', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<MedicationDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
    expect(mockDelete).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => {
      await buttons.find((b) => b.style === 'destructive')!.onPress!();
    });
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('p1', 'm1'));
    expect(mockBack).toHaveBeenCalled();
  });
});
