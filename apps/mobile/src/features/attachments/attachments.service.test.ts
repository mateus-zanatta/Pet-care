import type { AttachmentRef } from '@petcare/shared';
import { AttachmentError, addAttachment, deleteAllAttachmentFiles, newAttachmentId, removeAttachment } from './attachments.service';

const mockPutFile = jest.fn();
const mockDeleteObject = jest.fn();
const mockUpdateDoc = jest.fn();
const mockPrepare = jest.fn();

jest.mock('@react-native-firebase/storage', () => ({
  ref: (_s: unknown, path: string) => ({ fullPath: path }),
  putFile: (...a: unknown[]) => mockPutFile(...a),
  deleteObject: (...a: unknown[]) => mockDeleteObject(...a),
  getDownloadURL: jest.fn(),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  arrayUnion: (v: unknown) => ({ op: 'union', v }),
  arrayRemove: (v: unknown) => ({ op: 'remove', v }),
  serverTimestamp: () => 'TS',
}));
jest.mock('@/core/firebase', () => ({ db: () => ({}), storage: () => ({}) }));
jest.mock('@/core/media/image', () => ({ prepareImageForUpload: (...a: unknown[]) => mockPrepare(...a) }));
jest.mock('expo-file-system', () => ({
  File: class {
    size = 4321;
    static pickFileAsync = jest.fn();
  },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

const target = { collection: 'medications' as const, petId: 'p1', recordId: 'm1' };
const now = new Date(2026, 10, 4, 10, 0, 0);

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepare.mockResolvedValue({ uri: 'file:///cache/prepared.jpg' });
  mockPutFile.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
  mockDeleteObject.mockResolvedValue(undefined);
});

describe('newAttachmentId', () => {
  it('tem 20 caracteres em letras minúsculas e números', () => {
    expect(newAttachmentId()).toMatch(/^[a-z0-9]{20}$/);
    expect(newAttachmentId()).not.toBe(newAttachmentId());
  });
});

describe('addAttachment', () => {
  it('foto: reduz/recodifica, envia ao Storage dentro do pet e registra a referência no documento', async () => {
    const att = await addAttachment(target, { kind: 'photo', photo: { uri: 'file:///cam/x.jpg', width: 4000, height: 3000 } }, [], now);

    expect(mockPrepare).toHaveBeenCalledWith('file:///cam/x.jpg', 4000, 3000);
    const [fileRef, localPath, metadata] = mockPutFile.mock.calls[0]!;
    expect(fileRef.fullPath).toMatch(/^pets\/p1\/attachments\/m1\/[a-z0-9]{20}\.jpg$/);
    expect(localPath).toBe('/cache/prepared.jpg');
    expect(metadata).toEqual({ contentType: 'image/jpeg' });

    expect(att).toMatchObject({ name: 'foto-20261104.jpg', contentType: 'image/jpeg', size: 4321, addedAt: now.toISOString() });
    const [docRef, body] = mockUpdateDoc.mock.calls[0]!;
    expect(docRef.path).toBe('pets/p1/medications/m1');
    expect(body).toEqual({ attachments: { op: 'union', v: att }, updatedAt: 'TS' });
  });

  it('PDF: envia como application/pdf com o nome limpo (sem pastas)', async () => {
    const att = await addAttachment(target, { kind: 'pdf', uri: 'file:///d/hemograma.pdf', name: 'C:\\Users\\ana\\hemograma.pdf', size: 5000 }, [], now);
    expect(att).toMatchObject({ name: 'hemograma.pdf', contentType: 'application/pdf', size: 5000 });
    expect(mockPutFile.mock.calls[0]![0].fullPath).toMatch(/\.pdf$/);
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('recusa PDF acima de 10 MB e passa do limite de anexos, sem enviar nada', async () => {
    await expect(addAttachment(target, { kind: 'pdf', uri: 'u', name: 'a.pdf', size: 11 * 1024 * 1024 }, [], now)).rejects.toMatchObject({ code: 'too_large' });
    const full = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}` }) as AttachmentRef);
    await expect(addAttachment(target, { kind: 'pdf', uri: 'u', name: 'a.pdf', size: 1 }, full, now)).rejects.toBeInstanceOf(AttachmentError);
    expect(mockPutFile).not.toHaveBeenCalled();
  });

  it('se o registro no documento falhar, o arquivo enviado é apagado (sem órfãos) e o erro chega à tela', async () => {
    mockUpdateDoc.mockRejectedValue(Object.assign(new Error('x'), { code: 'firestore/permission-denied' }));
    await expect(addAttachment(target, { kind: 'pdf', uri: 'u', name: 'a.pdf', size: 1 }, [], now)).rejects.toMatchObject({ code: 'firestore/permission-denied' });
    expect(mockDeleteObject).toHaveBeenCalledTimes(1);
  });

  it('sem confirmação do servidor, o anexo segue como pendente (não trava a tela) e o arquivo é mantido', async () => {
    jest.useFakeTimers();
    mockUpdateDoc.mockReturnValue(new Promise(() => undefined));
    const pending = addAttachment(target, { kind: 'pdf', uri: 'u', name: 'a.pdf', size: 1 }, [], now);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ contentType: 'application/pdf' });
    expect(mockDeleteObject).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('se o envio ao Storage falhar, o documento NÃO é alterado', async () => {
    mockPutFile.mockRejectedValue(new Error('storage/unauthorized'));
    await expect(addAttachment(target, { kind: 'pdf', uri: 'u', name: 'a.pdf', size: 1 }, [], now)).rejects.toThrow();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('removeAttachment', () => {
  const att: AttachmentRef = { id: 'a1', path: 'pets/p1/attachments/m1/a1.pdf', name: 'a.pdf', contentType: 'application/pdf', size: 1, addedAt: now.toISOString() };

  it('apaga o arquivo e tira a referência do documento', async () => {
    await removeAttachment(target, att);
    expect(mockDeleteObject.mock.calls[0]![0].fullPath).toBe(att.path);
    expect(mockUpdateDoc.mock.calls[0]![1]).toEqual({ attachments: { op: 'remove', v: att }, updatedAt: 'TS' });
  });

  it('arquivo que já não existe no Storage não impede limpar o documento', async () => {
    mockDeleteObject.mockRejectedValue(Object.assign(new Error('x'), { code: 'storage/object-not-found' }));
    await removeAttachment(target, att);
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('outro erro do Storage interrompe (o documento continua apontando para o arquivo)', async () => {
    mockDeleteObject.mockRejectedValue(Object.assign(new Error('x'), { code: 'storage/unauthorized' }));
    await expect(removeAttachment(target, att)).rejects.toMatchObject({ code: 'storage/unauthorized' });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('deleteAllAttachmentFiles', () => {
  it('tenta apagar todos, mesmo que algum falhe', async () => {
    mockDeleteObject.mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    const list = [1, 2, 3].map((i) => ({ path: `pets/p1/attachments/m1/${i}.jpg` }) as AttachmentRef);
    await expect(deleteAllAttachmentFiles(list)).resolves.toBeUndefined();
    expect(mockDeleteObject).toHaveBeenCalledTimes(3);
    await expect(deleteAllAttachmentFiles(undefined)).resolves.toBeUndefined();
  });
});
