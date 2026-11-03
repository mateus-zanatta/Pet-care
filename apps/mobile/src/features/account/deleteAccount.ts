import { revokeToken } from '@react-native-firebase/auth';
import { httpsCallable } from '@react-native-firebase/functions';
import { auth, functions } from '@/core/firebase';
import { reportError } from '@/core/errors/report';
import { signOut } from '@/features/auth/auth.service';

/**
 * Exclui a conta e todos os dados (a Cloud Function faz o trabalho no servidor).
 * Para quem entrou com a Apple, o acesso é revogado antes (exigência da App Store).
 * Precisa ser chamado logo depois de `reauthenticate`.
 */
export async function deleteMyAccount({ appleAuthorizationCode }: { appleAuthorizationCode: string | null }) {
  if (appleAuthorizationCode) {
    try {
      await revokeToken(auth(), appleAuthorizationCode);
    } catch (error) {
      // Não bloqueia a exclusão, mas fica registrado (sem dados pessoais).
      reportError('account.appleRevoke', error);
    }
  }
  await httpsCallable<undefined, { ok: true }>(functions(), 'deleteAccount')();
  try {
    await signOut(); // a sessão já não vale mais; isto só limpa o aparelho
  } catch {
    // esperado: o usuário já foi removido no servidor
  }
}
