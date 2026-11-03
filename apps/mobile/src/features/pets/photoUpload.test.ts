import { uploadPhotoAfterSave } from './photoUpload';

const mockUpload = jest.fn();
const mockDiagnose = jest.fn();
const mockReport = jest.fn();

jest.mock('./pets.repo', () => ({ uploadPetPhoto: (...args: unknown[]) => mockUpload(...args) }));
jest.mock('@/core/firebase', () => ({ diagnoseEmulatorConnection: () => mockDiagnose() }));
jest.mock('@/core/errors/report', () => ({ reportError: (...args: unknown[]) => mockReport(...args) }));


const photo = { uri: 'data:image/jpeg;base64,AAAA', width: 0, height: 0, base64: 'AAAA' };

describe('uploadPhotoAfterSave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('envia a foto quando o servidor confirmou a gravação', async () => {
    mockUpload.mockResolvedValue(undefined);
    await expect(uploadPhotoAfterSave('p1', photo, 'committed', 'rga.photoUpload')).resolves.toBe('uploaded');
    expect(mockUpload).toHaveBeenCalledWith('p1', photo);
  });

  it('NÃO some em silêncio: sem confirmação do servidor devolve "deferred" e roda o diagnóstico', async () => {
    await expect(uploadPhotoAfterSave('p1', photo, 'pending', 'rga.photoUpload')).resolves.toBe('deferred');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockDiagnose).toHaveBeenCalledTimes(1);
  });

  it('devolve "failed" e registra o erro quando o envio falha', async () => {
    const error = Object.assign(new Error('x'), { code: 'storage/unauthorized' });
    mockUpload.mockRejectedValue(error);
    await expect(uploadPhotoAfterSave('p1', photo, 'committed', 'rga.photoUpload')).resolves.toBe('failed');
    expect(mockReport).toHaveBeenCalledWith('rga.photoUpload', error);
  });
});
