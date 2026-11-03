/**
 * A ordem das chamadas ao Firestore importa: no Android o settings() só vale se for gravado antes de
 * a instância nativa existir, e é o useEmulator() que a cria. Estes testes travam essa ordem.
 */
const mockCalls: string[] = [];
let mockSettingsImpl: () => Promise<void>;
let mockFirestoreEmulatorImpl: () => void;

jest.mock('@react-native-firebase/app', () => ({
  getApp: () => ({ options: { projectId: 'demo-petcare' } }),
}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({}),
  connectAuthEmulator: () => mockCalls.push('auth.useEmulator'),
}));
jest.mock('@react-native-firebase/storage', () => ({
  getStorage: () => ({}),
  connectStorageEmulator: () => mockCalls.push('storage.useEmulator'),
}));
jest.mock('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => mockCalls.push('functions.useEmulator'),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({
    settings: async () => {
      mockCalls.push('firestore.settings:start');
      await mockSettingsImpl();
      mockCalls.push('firestore.settings:done');
    },
  }),
  connectFirestoreEmulator: () => {
    mockCalls.push('firestore.useEmulator');
    mockFirestoreEmulatorImpl();
  },
  doc: () => ({}),
  getDocFromServer: jest.fn().mockRejectedValue({ code: 'firestore/permission-denied', message: 'x' }),
}));

describe('connectEmulatorsIfEnabled', () => {
  const originalHost = process.env.EXPO_PUBLIC_EMULATOR_HOST;

  beforeEach(() => {
    mockCalls.length = 0;
    mockSettingsImpl = async () => undefined;
    mockFirestoreEmulatorImpl = () => undefined;
    process.env.EXPO_PUBLIC_EMULATOR_HOST = '192.168.0.10';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({ status: 200 } as Response);
    jest.resetModules();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_EMULATOR_HOST = originalHost;
    jest.restoreAllMocks();
  });

  it('espera o settings() terminar ANTES de chamar o useEmulator() do Firestore', async () => {
    let release: () => void = () => undefined;
    mockSettingsImpl = () => new Promise<void>((resolve) => (release = resolve));
    const { connectEmulatorsIfEnabled, isUsingEmulators } = require('./index');

    const pending = connectEmulatorsIfEnabled();
    await Promise.resolve();
    expect(mockCalls).toContain('firestore.settings:start');
    expect(mockCalls).not.toContain('firestore.useEmulator'); // ainda esperando o settings()

    release();
    await pending;
    expect(mockCalls.indexOf('firestore.settings:done')).toBeLessThan(mockCalls.indexOf('firestore.useEmulator'));
    expect(isUsingEmulators()).toBe(true);
  });

  it('liga Auth, Storage e Functions também', async () => {
    const { connectEmulatorsIfEnabled } = require('./index');
    await connectEmulatorsIfEnabled();
    expect(mockCalls).toEqual(
      expect.arrayContaining(['auth.useEmulator', 'storage.useEmulator', 'functions.useEmulator', 'firestore.useEmulator']),
    );
  });

  it('segue em frente (e liga o Firestore) se o settings() falhar', async () => {
    mockSettingsImpl = () => Promise.reject(new Error('settings can no longer be changed'));
    const { connectEmulatorsIfEnabled } = require('./index');
    await expect(connectEmulatorsIfEnabled()).resolves.toBeUndefined();
    expect(mockCalls).toContain('firestore.useEmulator');
  });

  it('não trava se o settings() nunca responder (limite de 3 s)', async () => {
    jest.useFakeTimers();
    mockSettingsImpl = () => new Promise<void>(() => undefined);
    const { connectEmulatorsIfEnabled } = require('./index');
    const pending = connectEmulatorsIfEnabled();
    await jest.advanceTimersByTimeAsync(3000);
    await pending;
    expect(mockCalls).toContain('firestore.useEmulator');
    jest.useRealTimers();
  });

  it('nunca lança erro, mesmo se um dos emuladores falhar ao conectar', async () => {
    mockFirestoreEmulatorImpl = () => {
      throw new Error('boom');
    };
    const { connectEmulatorsIfEnabled } = require('./index');
    await expect(connectEmulatorsIfEnabled()).resolves.toBeUndefined();
  });
});
