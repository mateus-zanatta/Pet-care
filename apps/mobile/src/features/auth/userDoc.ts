import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { LEGAL_VERSION, type AppLocale } from '@petcare/shared';
import { db } from '@/core/firebase';

type Input = { uid: string; isAnonymous: boolean; displayName: string | null; locale: AppLocale };

/**
 * Garante o documento `users/{uid}` e o mantém em dia (idioma, nome, tipo de conta).
 * Registra o aceite dos Termos/Privacidade na primeira vez que a conta deixa de ser anônima
 * (o aceite é pedido nas telas de cadastro/login).
 */
export async function ensureUserDoc({ uid, isAnonymous, displayName, locale }: Input): Promise<void> {
  const ref = doc(db(), 'users', uid);
  const snap = await getDoc(ref);
  const consents = {
    termsVersion: LEGAL_VERSION,
    privacyVersion: LEGAL_VERSION,
    acceptedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      locale,
      isAnonymous,
      ...(displayName ? { displayName } : {}),
      ...(isAnonymous ? {} : { consents }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const current = snap.data() ?? {};
  const patch: Record<string, unknown> = {};
  if (current.locale !== locale) patch.locale = locale;
  if (current.isAnonymous !== isAnonymous) patch.isAnonymous = isAnonymous;
  if (displayName && current.displayName !== displayName) patch.displayName = displayName;
  if (!isAnonymous && !current.consents) patch.consents = consents;
  if (Object.keys(patch).length > 0) {
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
  }
}
