import { geocodeAddress, getCurrentPosition, getLocationPermission, requestLocationPermission } from './location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
}));


type Mocked = Record<
  | 'getForegroundPermissionsAsync'
  | 'requestForegroundPermissionsAsync'
  | 'hasServicesEnabledAsync'
  | 'getLastKnownPositionAsync'
  | 'getCurrentPositionAsync'
  | 'geocodeAsync',
  jest.Mock
>;
const mockLocation = jest.requireMock('expo-location') as Mocked;
const coords = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } });

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  mockLocation.getLastKnownPositionAsync.mockResolvedValue(null);
});

describe('localização', () => {
  it('traduz a permissão do sistema; só "durante o uso"', async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true });
    await expect(getLocationPermission()).resolves.toBe('granted');
    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false });
    await expect(getLocationPermission()).resolves.toBe('denied');
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true });
    await expect(requestLocationPermission()).resolves.toBe('undetermined');
  });

  it('usa a última posição conhecida (rápido) quando existe', async () => {
    mockLocation.getLastKnownPositionAsync.mockResolvedValueOnce(coords(-23.5, -46.6));
    await expect(getCurrentPosition()).resolves.toEqual({ lat: -23.5, lng: -46.6 });
    expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('senão, pede uma posição nova com precisão equilibrada', async () => {
    mockLocation.getCurrentPositionAsync.mockResolvedValueOnce(coords(-22.9, -43.2));
    await expect(getCurrentPosition()).resolves.toEqual({ lat: -22.9, lng: -43.2 });
    expect(mockLocation.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
  });

  it('GPS desligado e demora demais viram erros claros', async () => {
    mockLocation.hasServicesEnabledAsync.mockResolvedValueOnce(false);
    await expect(getCurrentPosition()).rejects.toMatchObject({ code: 'services-off' });

    jest.useFakeTimers();
    mockLocation.getCurrentPositionAsync.mockReturnValueOnce(new Promise(() => undefined));
    const pending = getCurrentPosition();
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await jest.advanceTimersByTimeAsync(15_000);
    await assertion;
    jest.useRealTimers();
  });

  it('endereço digitado: usa o 1º resultado; nenhum resultado vira "não encontrado"', async () => {
    mockLocation.geocodeAsync.mockResolvedValueOnce([{ latitude: -23.56, longitude: -46.65 }]);
    await expect(geocodeAddress(' Av. Paulista ')).resolves.toEqual({ lat: -23.56, lng: -46.65 });
    expect(mockLocation.geocodeAsync).toHaveBeenCalledWith('Av. Paulista');
    mockLocation.geocodeAsync.mockResolvedValueOnce([]);
    await expect(geocodeAddress('xyz')).rejects.toMatchObject({ code: 'not-found' });
  });
});
