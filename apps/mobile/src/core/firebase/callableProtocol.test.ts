import { buildEmulatorCallableUrl, callableErrorCode, isNetworkError, unwrapCallableBody } from './callableProtocol';

describe('protocolo callable por HTTP', () => {
  it('monta a URL do emulador de Functions', () => {
    expect(buildEmulatorCallableUrl('192.168.8.12', 5001, 'demo-petcare', 'southamerica-east1', 'deleteAccount')).toBe(
      'http://192.168.8.12:5001/demo-petcare/southamerica-east1/deleteAccount',
    );
  });

  it('converte o status do servidor no código de erro do app', () => {
    expect(callableErrorCode('FAILED_PRECONDITION')).toBe('functions/failed-precondition');
    expect(callableErrorCode('PERMISSION_DENIED')).toBe('functions/permission-denied');
    expect(callableErrorCode(undefined)).toBe('functions/unknown');
  });

  it('devolve o resultado em caso de sucesso', () => {
    expect(unwrapCallableBody<{ ok: boolean }>({ result: { ok: true } })).toEqual({ ok: true });
  });

  it('lança erro com código quando o servidor recusa', () => {
    expect.assertions(2);
    try {
      unwrapCallableBody({ error: { message: 'owner-only', status: 'PERMISSION_DENIED' } });
    } catch (error) {
      expect((error as Error).message).toBe('owner-only');
      expect((error as { code: string }).code).toBe('functions/permission-denied');
    }
  });
});

describe('isNetworkError', () => {
  it('reconhece falhas de rede do login, das funções e do fetch', () => {
    expect(isNetworkError({ code: 'auth/network-request-failed', message: '[auth/network-request-failed] A network error' })).toBe(true);
    expect(isNetworkError({ code: 'functions/unavailable' })).toBe(true);
    expect(isNetworkError({ code: 'functions/deadline-exceeded' })).toBe(true);
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new Error('Request timed out'))).toBe(true);
  });
  it('NÃO confunde com recusa do servidor', () => {
    expect(isNetworkError({ code: 'functions/permission-denied', message: 'owner-only' })).toBe(false);
    expect(isNetworkError({ code: 'functions/invalid-argument' })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
