import {
  type AuthCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  type User,
  createUserWithEmailAndPassword,
  linkWithCredential,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { auth } from '@/core/firebase';
import { AppAuthError } from './errors';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** O login com Google só aparece quando o "ID do cliente da Web" foi configurado (veja SETUP.md). */
export function isGoogleSignInAvailable(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

/** Chamar uma vez na inicialização do app. */
export function configureGoogleSignIn(): void {
  if (!GOOGLE_WEB_CLIENT_ID) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

/* ------------------------------ Credenciais ------------------------------ */

async function googleCredential(): Promise<AuthCredential> {
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success' || !response.data.idToken) throw new AppAuthError('app/cancelled');
  return GoogleAuthProvider.credential(response.data.idToken);
}

function randomNonce(): string {
  return Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

type AppleResult = { credential: AuthCredential; authorizationCode: string | null; givenName: string | null };

async function appleCredential(): Promise<AppleResult> {
  if (!(await AppleAuthentication.isAvailableAsync())) throw new AppAuthError('app/provider-unavailable');
  // A Apple recebe o hash do nonce; o Firebase recebe o nonce original para conferir.
  const rawNonce = randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const apple = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!apple.identityToken) throw new AppAuthError('app/cancelled');
  return {
    credential: new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce }),
    authorizationCode: apple.authorizationCode,
    givenName: apple.fullName?.givenName ?? null,
  };
}

/* --------------------------- Entrar / vincular --------------------------- */

/**
 * Se a pessoa está "sem cadastro" (anônima), VINCULA o login à conta atual, mantendo o
 * que ela já registrou (resgates etc.). Se o login já pertence a outra conta, entra nela.
 */
async function signInOrLink(credential: AuthCredential): Promise<User> {
  const current = auth().currentUser;
  if (current?.isAnonymous) {
    try {
      return (await linkWithCredential(current, credential)).user;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') throw error;
    }
  }
  return (await signInWithCredential(auth(), credential)).user;
}

export const signInAnonymouslyNow = () => signInAnonymously(auth());

/** Entrar numa conta existente a partir de uma sessão anônima troca para essa conta. */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email.trim(), password);
}

export async function registerWithEmail(input: { name: string; email: string; password: string }): Promise<User> {
  const current = auth().currentUser;
  let user: User;
  if (current?.isAnonymous) {
    user = (await linkWithCredential(current, EmailAuthProvider.credential(input.email.trim(), input.password))).user;
  } else {
    user = (await createUserWithEmailAndPassword(auth(), input.email.trim(), input.password)).user;
  }
  await updateProfile(user, { displayName: input.name.trim() });
  return user;
}

export async function signInWithGoogle(): Promise<void> {
  await signInOrLink(await googleCredential());
}

export async function signInWithApple(): Promise<void> {
  const { credential, givenName } = await appleCredential();
  const user = await signInOrLink(credential);
  // A Apple só entrega o nome na primeira vez; guardamos no perfil.
  if (givenName && !user.displayName) await updateProfile(user, { displayName: givenName });
}

export const sendPasswordReset = (email: string) => sendPasswordResetEmail(auth(), email.trim());

export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // não estava logado com Google
  }
  await firebaseSignOut(auth());
}

/* ----------------------- Reautenticação (ações sensíveis) ----------------------- */

export type ReauthMethod =
  | { type: 'password'; password: string }
  | { type: 'google' }
  | { type: 'apple' };

/** Confirma a identidade de novo. Para a Apple devolve o código necessário para revogar o acesso. */
export async function reauthenticate(method: ReauthMethod): Promise<{ appleAuthorizationCode: string | null }> {
  const user = auth().currentUser;
  if (!user) throw new AppAuthError('app/cancelled');

  switch (method.type) {
    case 'password': {
      if (!user.email) throw new AppAuthError('app/provider-unavailable');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, method.password));
      return { appleAuthorizationCode: null };
    }
    case 'google': {
      await reauthenticateWithCredential(user, await googleCredential());
      return { appleAuthorizationCode: null };
    }
    case 'apple': {
      const { credential, authorizationCode } = await appleCredential();
      await reauthenticateWithCredential(user, credential);
      return { appleAuthorizationCode: authorizationCode };
    }
  }
}

export type ProviderKind = 'password' | 'google.com' | 'apple.com' | 'anonymous';

export function providerOf(user: User): ProviderKind {
  if (user.isAnonymous) return 'anonymous';
  const ids = user.providerData.map((p) => p.providerId);
  if (ids.includes('apple.com')) return 'apple.com';
  if (ids.includes('google.com')) return 'google.com';
  return 'password';
}
