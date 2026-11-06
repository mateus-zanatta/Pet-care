import { isNetworkError } from '@/core/firebase/callableProtocol';

/** Erro de uma Cloud Function das centrais -> chave de tradução (namespace "centrals"). */
export type CentralErrorKey =
  | 'errors.dailyLimit'
  | 'errors.accountRequired'
  | 'errors.ownerOnly'
  | 'errors.invalid'
  | 'errors.network'
  | 'errors.generic';

export function centralErrorKey(error: unknown): CentralErrorKey {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message : '';
  if (code === 'functions/resource-exhausted' || message === 'daily-limit') return 'errors.dailyLimit';
  if (message === 'account-required' || code === 'functions/unauthenticated') return 'errors.accountRequired';
  if (code === 'functions/permission-denied') return 'errors.ownerOnly';
  if (code === 'functions/invalid-argument') return 'errors.invalid';
  if (isNetworkError(error)) return 'errors.network';
  return 'errors.generic';
}
