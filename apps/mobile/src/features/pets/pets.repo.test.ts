import { uploadPetPhoto } from './pets.repo';

const mockUploadString = jest.fn();
const mockPutFile = jest.fn();
const mockUpdateDoc = jest.fn();
const mockPrepare = jest.fn();

jest.mock('@react-native-firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  uploadString: (...args: unknown[]) => mockUploadString(...args),
  putFile: (...args: unknown[]) => mockPutFile(...args),
  deleteObject: jest.fn(),
  getDownloadURL: jest.fn(),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(),
  deleteField: jest.fn(() => 'DELETE'),
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => 'TS'),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));
jest.mock('@/core/firebase', () => ({ db: () => ({}), storage: () => ({}) }));
jest.mock('@/core/firebase/callable', () => ({ callFunction: jest.fn() }));
jest.mock('@/core/media/image', () => ({ prepareImageForUpload: (...args: unknown[]) => mockPrepare(...args) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPrepare.mockResolvedValue({ uri: 'file:///cache/prepared.jpg' });
  mockUploadString.mockResolvedValue(undefined);
  mockPutFile.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
});

describe('uploadPetPhoto', () => {
  it('foto do RG (base64): envia direto, sem arquivo local nem reprocessamento, e registra no pet', async () => {
    await uploadPetPhoto('p1', { uri: 'data:image/jpeg;base64,QUJD', width: 0, height: 0, base64: 'QUJD' });

    expect(mockUploadString).toHaveBeenCalledWith({ fullPath: 'pets/p1/profile.jpg' }, 'QUJD', 'base64', {
      contentType: 'image/jpeg',
    });
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(mockPutFile).not.toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { path: 'pets/p1' },
      expect.objectContaining({ photoPath: 'pets/p1/profile.jpg', photoUpdatedAt: 'TS' }),
    );
  });

  it('foto da galeria/câmera: reduz, tira a localização e envia o arquivo', async () => {
    await uploadPetPhoto('p1', { uri: 'file:///cache/foto.jpg', width: 3000, height: 2000 });

    expect(mockPrepare).toHaveBeenCalledWith('file:///cache/foto.jpg', 3000, 2000);
    expect(mockPutFile).toHaveBeenCalledWith({ fullPath: 'pets/p1/profile.jpg' }, '/cache/prepared.jpg', {
      contentType: 'image/jpeg',
    });
    expect(mockUploadString).not.toHaveBeenCalled();
  });

  it('se o envio falhar, o pet NÃO é marcado com uma foto que não existe', async () => {
    mockUploadString.mockRejectedValue(new Error('storage/unauthorized'));
    await expect(uploadPetPhoto('p1', { uri: 'data:x', width: 0, height: 0, base64: 'QUJD' })).rejects.toThrow();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
