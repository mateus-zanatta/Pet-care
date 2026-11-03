import { createMedication, logDose, setMedicationStatus, updateMedication } from './medications.repo';

const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => 'DELETE'),
  doc: (parent: { path?: string } | unknown, ...path: string[]) => {
    const base = (parent as { path?: string })?.path;
    return { path: [base, ...path].filter(Boolean).join('/') || 'auto', id: path[path.length - 1] ?? 'auto-id' };
  },
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => 'TS'),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: jest.fn(),
}));
jest.mock('@/core/firebase', () => ({ db: () => ({}) }));

const data = {
  name: 'Amoxicilina',
  dose: { amount: '1', unit: 'comprimido', route: 'oral' as const },
  frequency: { kind: 'interval' as const, everyHours: 8 },
  startDate: '2026-11-04',
  status: 'active' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
});

describe('createMedication', () => {
  it('grava no pet certo com autor e carimbos do servidor, e confirma', async () => {
    const result = await createMedication('p1', 'u1', data);
    expect(result.status).toBe('committed');
    const [ref, body] = mockSetDoc.mock.calls[0]!;
    expect(ref.path).toContain('pets/p1/medications');
    expect(body).toMatchObject({ ...data, createdBy: 'u1', createdAt: 'TS', updatedAt: 'TS' });
  });

  it('se o servidor não confirmar a tempo, segue como "pending" (sem esconder nada)', async () => {
    jest.useFakeTimers();
    mockSetDoc.mockReturnValue(new Promise(() => undefined));
    const pending = createMedication('p1', 'u1', data);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ status: 'pending' });
    jest.useRealTimers();
  });

  it('se as regras recusarem, o erro CHEGA à tela (nada de falha silenciosa)', async () => {
    mockSetDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'firestore/permission-denied' }));
    await expect(createMedication('p1', 'u1', data)).rejects.toMatchObject({ code: 'firestore/permission-denied' });
  });
});

describe('updateMedication / setMedicationStatus', () => {
  it('atualiza só os campos do formulário, com updatedAt do servidor', async () => {
    await updateMedication('p1', 'm1', data);
    const [ref, body] = mockUpdateDoc.mock.calls[0]!;
    expect(ref.path).toBe('pets/p1/medications/m1');
    expect(body).toMatchObject({ name: 'Amoxicilina', updatedAt: 'TS', batch: 'DELETE' });
    expect('createdBy' in body).toBe(false);
  });
  it('concluir/suspender muda só o status', async () => {
    await setMedicationStatus('p1', 'm1', 'completed');
    expect(mockUpdateDoc.mock.calls[0]![1]).toEqual({ status: 'completed', updatedAt: 'TS' });
  });
});

describe('logDose', () => {
  const scheduledFor = new Date('2026-11-04T11:00:00.000Z');
  const now = new Date('2026-11-04T11:07:00.000Z');

  it('usa o ID determinístico (remédio + minuto) e guarda quem deu e o horário real', async () => {
    const { id, status } = await logDose({
      petId: 'p1', medicationId: 'm1', scheduledFor, outcome: 'given', uid: 'u1', displayName: 'Ana', now,
    });
    expect(status).toBe('committed');
    expect(id).toBe(`m1_${Math.floor(scheduledFor.getTime() / 60_000)}`);
    const [ref, body] = mockSetDoc.mock.calls[0]!;
    expect(ref.path).toBe(`pets/p1/dose_logs/${id}`);
    expect(body).toEqual({
      medicationId: 'm1',
      scheduledFor: '2026-11-04T11:00:00.000Z',
      outcome: 'given',
      actualAt: '2026-11-04T11:07:00.000Z',
      byUid: 'u1',
      byName: 'Ana',
      createdAt: 'TS',
    });
  });

  it('sem nome de exibição, não grava byName; e "pulei" é um resultado como outro qualquer', async () => {
    await logDose({ petId: 'p1', medicationId: 'm1', scheduledFor, outcome: 'skipped', uid: 'u1', displayName: null, now });
    const body = mockSetDoc.mock.calls[0]![1];
    expect('byName' in body).toBe(false);
    expect(body.outcome).toBe('skipped');
  });

  it('registrar duas vezes a mesma dose usa o MESMO documento', async () => {
    const input = { petId: 'p1', medicationId: 'm1', scheduledFor, outcome: 'given' as const, uid: 'u1', displayName: null, now };
    const a = await logDose(input);
    const b = await logDose(input);
    expect(a.id).toBe(b.id);
  });
});
