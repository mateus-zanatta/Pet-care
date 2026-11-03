import { EMULATOR_PORTS, hostFromUri, pingEmulators, resolveEmulatorSettings } from './diagnostics';

describe('pingEmulators', () => {
  it('marca como alcançável qualquer porta que responda (mesmo com 404)', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ status: 404 });
    const results = await pingEmulators('192.168.0.10', fakeFetch as unknown as typeof fetch);
    expect(results).toHaveLength(EMULATOR_PORTS.length);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(fakeFetch).toHaveBeenCalledWith('http://192.168.0.10:9099/', expect.anything());
  });

  it('mostra qual porta falhou e o motivo', async () => {
    const fakeFetch = jest.fn((url: string) =>
      url.includes(':9099') ? Promise.reject(new Error('Network request failed')) : Promise.resolve({ status: 200 }),
    );
    const results = await pingEmulators('10.0.0.5', fakeFetch as unknown as typeof fetch);
    const auth = results.find((r) => r.port === 9099)!;
    expect(auth.ok).toBe(false);
    expect(auth.detail).toBe('Network request failed');
    expect(results.filter((r) => r.ok)).toHaveLength(EMULATOR_PORTS.length - 1);
  });

  it('trata falta de resposta como tempo esgotado', async () => {
    jest.useFakeTimers();
    const hanging = jest.fn((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const pending = pingEmulators('10.0.0.5', hanging as unknown as typeof fetch, 3000);
    await jest.advanceTimersByTimeAsync(3000);
    const results = await pending;
    expect(results.every((r) => !r.ok && r.detail === 'sem resposta em 3s')).toBe(true);
    jest.useRealTimers();
  });
});

describe('hostFromUri', () => {
  it('extrai o host de endereços do Metro', () => {
    expect(hostFromUri('192.168.0.10:8081')).toBe('192.168.0.10');
    expect(hostFromUri('http://192.168.0.10:8081/index.bundle?platform=android')).toBe('192.168.0.10');
    expect(hostFromUri('exp://meu-pc.local:8081')).toBe('meu-pc.local');
  });
  it('devolve undefined sem endereço', () => {
    expect(hostFromUri(undefined)).toBeUndefined();
    expect(hostFromUri('')).toBeUndefined();
  });
});

describe('resolveEmulatorSettings', () => {
  it('projeto demo-* liga os emuladores sozinho, usando o endereço do Metro', () => {
    expect(resolveEmulatorSettings({ projectId: 'demo-petcare', metroHostUri: '192.168.0.10:8081' })).toMatchObject({
      enabled: true,
      host: '192.168.0.10',
      hostSource: 'metro',
    });
  });

  it('EXPO_PUBLIC_EMULATOR_HOST tem prioridade sobre o endereço do Metro', () => {
    expect(
      resolveEmulatorSettings({ projectId: 'demo-petcare', explicitHost: '10.0.0.7', metroHostUri: '192.168.0.10:8081' }),
    ).toMatchObject({ enabled: true, host: '10.0.0.7', hostSource: 'env' });
  });

  it('sem nada, cai em 10.0.2.2 (emulador de Android)', () => {
    expect(resolveEmulatorSettings({ projectId: 'demo-petcare' })).toMatchObject({
      enabled: true,
      host: '10.0.2.2',
      hostSource: 'default',
    });
  });

  it('projeto real só usa emuladores com a variável ligada', () => {
    expect(resolveEmulatorSettings({ projectId: 'pet-care-1234', metroHostUri: '192.168.0.10:8081' })).toMatchObject({
      enabled: false,
    });
    expect(
      resolveEmulatorSettings({ projectId: 'pet-care-1234', flag: 'true', metroHostUri: '192.168.0.10:8081' }),
    ).toMatchObject({ enabled: true, host: '192.168.0.10' });
  });
});
