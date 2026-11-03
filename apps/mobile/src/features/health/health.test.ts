import { buildHealthEventUpdate, buildVaccineUpdate, parseHealthEvent, parseVaccine } from './health.mapper';
import { createHealthEvent, createVaccine, updateHealthEvent, updateVaccine } from './health.repo';

const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => 'DELETE'),
  doc: (parent: { path?: string }, ...path: string[]) => ({ path: [parent?.path, ...path].filter(Boolean).join('/'), id: 'new-id' }),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => 'TS'),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
}));
jest.mock('@/core/firebase', () => ({ db: () => ({}) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
});

describe('mapper', () => {
  it('lê vacina e evento válidos; ignora documentos corrompidos', () => {
    expect(parseVaccine('v1', { name: 'V10', appliedOn: '2026-10-01', createdBy: 'u1' })).toMatchObject({ id: 'v1', name: 'V10' });
    expect(parseVaccine('v1', { name: 'V10', appliedOn: 'ontem', createdBy: 'u1' })).toBeNull();
    expect(parseHealthEvent('e1', { type: 'exam', date: '2026-10-01', title: 'Hemograma', createdBy: 'u1' })).toMatchObject({ id: 'e1', type: 'exam' });
    expect(parseHealthEvent('e1', { type: 'magic', date: '2026-10-01', title: 'x', createdBy: 'u1' })).toBeNull();
  });

  it('lê os anexos junto do documento', () => {
    const att = { id: 'a1', path: 'p', name: 'n.pdf', contentType: 'application/pdf', size: 1, addedAt: '2026-11-04T10:00:00.000Z' };
    expect(parseVaccine('v1', { name: 'V10', appliedOn: '2026-10-01', createdBy: 'u1', attachments: [att] })?.attachments).toEqual([att]);
  });

  it('atualização: opcionais apagados viram "remover"; anexos e autoria não são tocados', () => {
    const v = buildVaccineUpdate({ name: 'V10', appliedOn: '2026-10-01' }, 'DELETE');
    expect(v).toMatchObject({ name: 'V10', nextDoseOn: 'DELETE', batch: 'DELETE', vet: 'DELETE', clinic: 'DELETE', notes: 'DELETE' });
    expect('attachments' in v).toBe(false);
    expect('createdBy' in v).toBe(false);
    const e = buildHealthEventUpdate({ type: 'exam', date: '2026-10-01', title: 'T', nextDate: '2027-01-01' }, 'DELETE');
    expect(e).toMatchObject({ nextDate: '2027-01-01', description: 'DELETE', vet: 'DELETE', clinic: 'DELETE' });
    expect('attachments' in e).toBe(false);
  });
});

describe('repo', () => {
  it('cria vacina e evento no pet certo, com autor e carimbos do servidor', async () => {
    const v = await createVaccine('p1', 'u1', { name: 'V10', appliedOn: '2026-10-01' });
    expect(v.status).toBe('committed');
    expect(mockSetDoc.mock.calls[0]![0].path).toContain('pets/p1/vaccines');
    expect(mockSetDoc.mock.calls[0]![1]).toMatchObject({ name: 'V10', createdBy: 'u1', createdAt: 'TS', updatedAt: 'TS' });

    await createHealthEvent('p1', 'u1', { type: 'exam', date: '2026-10-01', title: 'Hemograma' });
    expect(mockSetDoc.mock.calls[1]![0].path).toContain('pets/p1/health_events');
  });

  it('recusa das regras chega à tela; sem confirmação do servidor vira "pending"', async () => {
    mockSetDoc.mockRejectedValue(Object.assign(new Error('denied'), { code: 'firestore/permission-denied' }));
    await expect(createVaccine('p1', 'u1', { name: 'V10', appliedOn: '2026-10-01' })).rejects.toMatchObject({ code: 'firestore/permission-denied' });

    jest.useFakeTimers();
    mockSetDoc.mockReturnValue(new Promise(() => undefined));
    const pending = createHealthEvent('p1', 'u1', { type: 'exam', date: '2026-10-01', title: 'T' });
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ status: 'pending' });
    jest.useRealTimers();
  });

  it('atualiza com updatedAt do servidor', async () => {
    await updateVaccine('p1', 'v1', { name: 'V10', appliedOn: '2026-10-01' });
    expect(mockUpdateDoc.mock.calls[0]![0].path).toBe('pets/p1/vaccines/v1');
    expect(mockUpdateDoc.mock.calls[0]![1]).toMatchObject({ updatedAt: 'TS' });
    await updateHealthEvent('p1', 'e1', { type: 'exam', date: '2026-10-01', title: 'T' });
    expect(mockUpdateDoc.mock.calls[1]![0].path).toBe('pets/p1/health_events/e1');
  });
});
