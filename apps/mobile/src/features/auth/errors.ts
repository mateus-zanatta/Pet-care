/** Traduz erros do Firebase/Google/Apple em chaves de tradução (namespace "errors"). */
export type AuthErrorKey =
  | 'auth.invalidCredentials'
  | 'auth.emailInUse'
  | 'auth.weakPassword'
  | 'auth.invalidEmail'
  | 'auth.tooManyRequests'
  | 'auth.userDisabled'
  | 'auth.requiresRecentLogin'
  | 'auth.providerUnavailable'
  | 'auth.cancelled'
  | 'network'
  | 'generic';

const BY_CODE: Record<string, AuthErrorKey> = {
  // Não distinguimos "e-mail não existe" de "senha errada" (evita revelar quem tem conta).
  'auth/invalid-credential': 'auth.invalidCredentials',
  'auth/wrong-password': 'auth.invalidCredentials',
  'auth/user-not-found': 'auth.invalidCredentials',
  'auth/invalid-login-credentials': 'auth.invalidCredentials',
  'auth/email-already-in-use': 'auth.emailInUse',
  'auth/weak-password': 'auth.weakPassword',
  'auth/invalid-email': 'auth.invalidEmail',
  'auth/too-many-requests': 'auth.tooManyRequests',
  'auth/user-disabled': 'auth.userDisabled',
  'auth/requires-recent-login': 'auth.requiresRecentLogin',
  'auth/network-request-failed': 'network',
  // Cancelamentos (Google, Apple e fluxo interno)
  SIGN_IN_CANCELLED: 'auth.cancelled',
  ERR_REQUEST_CANCELED: 'auth.cancelled',
  'app/cancelled': 'auth.cancelled',
  // Indisponibilidade do provedor
  PLAY_SERVICES_NOT_AVAILABLE: 'auth.providerUnavailable',
  'app/provider-unavailable': 'auth.providerUnavailable',
};

export function mapAuthError(error: unknown): AuthErrorKey {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code in BY_CODE) return BY_CODE[code]!;
  return 'generic';
}

export function isCancelled(error: unknown): boolean {
  return mapAuthError(error) === 'auth.cancelled';
}

/** Erros criados pelo próprio app (mesmo formato { code }). */
export class AppAuthError extends Error {
  constructor(public readonly code: 'app/cancelled' | 'app/provider-unavailable') {
    super(code);
    this.name = 'AppAuthError';
  }
}
