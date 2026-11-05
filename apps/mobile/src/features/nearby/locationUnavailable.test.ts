import { geocodeAddress, getCurrentPosition, getLocationPermission, isLocationAvailable, requestLocationPermission } from './location';

// Simula um build ANTIGO do app: o módulo nativo de localização não existe.
jest.mock('expo-location', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  throw new Error("Cannot find native module 'ExpoLocation'");
});


describe('localização em build sem o módulo', () => {
  it('não quebra o app: tudo responde "indisponível"', async () => {
    expect(isLocationAvailable()).toBe(false);
    await expect(getLocationPermission()).resolves.toBe('unavailable');
    await expect(requestLocationPermission()).resolves.toBe('unavailable');
    await expect(getCurrentPosition()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(geocodeAddress('x')).rejects.toMatchObject({ code: 'unavailable' });
  });
});
