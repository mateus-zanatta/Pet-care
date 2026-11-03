import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { auth, bucket, db } from '../admin';
import { callableOptions } from '../config';
import { isRecentLogin } from '../lib/recentLogin';
import { deleteAccountCascade } from './deletion';

/**
 * Exclui a conta e TODOS os dados da pessoa (exigência da LGPD e das lojas de apps).
 * O app reautentica a pessoa imediatamente antes de chamar esta função.
 */
export const deleteAccount = onCall({ ...callableOptions, memory: '512MiB', timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'auth-required');

  // Conta anônima não tem senha/conta para reconfirmar; as demais precisam de login recente.
  const isAnonymous = request.auth.token.firebase?.sign_in_provider === 'anonymous';
  const authTime = request.auth.token.auth_time as number | undefined;
  if (!isAnonymous && !isRecentLogin(authTime)) {
    throw new HttpsError('failed-precondition', 'recent-login-required');
  }

  const uid = request.auth.uid;
  try {
    const summary = await deleteAccountCascade({ db: db(), bucket: bucket(), auth: auth() }, uid);
    // Sem uid nem dados pessoais no log: só contagens.
    logger.info('account_deleted', summary);
    return { ok: true };
  } catch (error) {
    logger.error('account_delete_failed', { message: (error as Error).message });
    throw new HttpsError('internal', 'delete-failed');
  }
});
