import { onAuthStateChanged, onIdTokenChanged } from '@react-native-firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppLocale } from '@petcare/shared';
import { auth } from '@/core/firebase';
import { reportError } from '@/core/errors/report';
import { type ProviderKind, providerOf } from './auth.service';
import { ensureUserDoc } from './userDoc';

export type AppUser = {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
  provider: ProviderKind;
};

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: AppUser };

type AuthContextValue = AuthState & {
  /** Relê o usuário atual (ex.: depois de mudar o nome do perfil). */
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sameUser(a: AppUser, b: AppUser): boolean {
  return (
    a.uid === b.uid &&
    a.isAnonymous === b.isAnonymous &&
    a.email === b.email &&
    a.displayName === b.displayName &&
    a.provider === b.provider
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const locale = (i18n.language === 'en' ? 'en' : 'pt-BR') as AppLocale;

  const readCurrent = useCallback(() => {
    const u = auth().currentUser;
    if (!u) {
      setState((prev) => (prev.status === 'signedOut' ? prev : { status: 'signedOut', user: null }));
      return;
    }
    const next: AppUser = {
      uid: u.uid,
      isAnonymous: u.isAnonymous,
      email: u.email,
      displayName: u.displayName,
      provider: providerOf(u),
    };
    // Evita re-renderizar o app inteiro quando nada mudou (ex.: renovação do token).
    setState((prev) =>
      prev.status === 'signedIn' && sameUser(prev.user, next) ? prev : { status: 'signedIn', user: next },
    );
  }, []);

  useEffect(() => {
    // onAuthStateChanged: entrar/sair. onIdTokenChanged: também dispara quando uma conta
    // anônima é vinculada a e-mail/Google/Apple (o uid não muda, mas isAnonymous muda).
    const unsubscribeState = onAuthStateChanged(auth(), readCurrent);
    const unsubscribeToken = onIdTokenChanged(auth(), readCurrent);
    return () => {
      unsubscribeState();
      unsubscribeToken();
    };
  }, [readCurrent]);

  // Mantém users/{uid} atualizado sem bloquear a interface.
  const uid = state.user?.uid;
  const isAnonymous = state.user?.isAnonymous;
  const displayName = state.user?.displayName ?? null;
  useEffect(() => {
    if (!uid || isAnonymous === undefined) return;
    ensureUserDoc({ uid, isAnonymous, displayName, locale }).catch((e) => reportError('auth.ensureUserDoc', e));
  }, [uid, isAnonymous, displayName, locale]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, refresh: readCurrent }), [state, readCurrent]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

/** Para telas que só existem com usuário logado. */
export function useUser(): AppUser {
  const { user } = useAuth();
  if (!user) throw new Error('useUser chamado sem usuário logado');
  return user;
}
