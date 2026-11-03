import { AppAuthError, isCancelled, mapAuthError } from './errors';

describe('mapAuthError', () => {
  it('não revela se o e-mail existe', () => {
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
      expect(mapAuthError({ code })).toBe('auth.invalidCredentials');
    }
  });
  it('mapeia erros comuns', () => {
    expect(mapAuthError({ code: 'auth/email-already-in-use' })).toBe('auth.emailInUse');
    expect(mapAuthError({ code: 'auth/network-request-failed' })).toBe('network');
    expect(mapAuthError({ code: 'auth/too-many-requests' })).toBe('auth.tooManyRequests');
  });
  it('reconhece cancelamentos do Google, da Apple e do app', () => {
    expect(isCancelled({ code: 'SIGN_IN_CANCELLED' })).toBe(true);
    expect(isCancelled({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isCancelled(new AppAuthError('app/cancelled'))).toBe(true);
    expect(isCancelled({ code: 'auth/invalid-credential' })).toBe(false);
  });
  it('erro desconhecido vira mensagem genérica', () => {
    expect(mapAuthError(new Error('boom'))).toBe('generic');
    expect(mapAuthError(null)).toBe('generic');
    expect(mapAuthError({ code: 123 })).toBe('generic');
  });
});
