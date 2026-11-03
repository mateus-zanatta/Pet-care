import { buildEmulatorCallableUrl, callableErrorCode, unwrapCallableBody } from './callableProtocol';

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
