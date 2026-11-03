import { renderRouter, screen } from 'expo-router/testing-library';
import React from 'react';
import { setupTestI18n } from '@/test/render';

/**
 * Teste de navegação com as rotas REAIS (src/app): confirma quem vê o quê conforme o login.
 * Firebase e módulos nativos são trocados por simulações.
 */

type MockAuth =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | {
      status: 'signedIn';
      user: { uid: string; isAnonymous: boolean; email: string | null; displayName: string | null; provider: string };
    };

let mockAuth: MockAuth = { status: 'signedOut', user: null };

jest.mock('@/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ ...mockAuth, refresh: jest.fn() }),
  useUser: () => {
    if (mockAuth.status !== 'signedIn') throw new Error('sem usuário');
    return mockAuth.user;
  },
}));
jest.mock('@/features/auth/auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  isGoogleSignInAvailable: () => false,
  signInAnonymouslyNow: jest.fn(),
  signInWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('@/core/firebase', () => ({ connectEmulatorsIfEnabled: jest.fn(), isUsingEmulators: () => false }));
jest.mock('@/features/pets/pets.repo', () => ({
  subscribeMemberships: (_uid: string, onData: (m: unknown[]) => void) => {
    onData([]);
    return () => undefined;
  },
  subscribePet: jest.fn(() => () => undefined),
  getPhotoUrl: jest.fn(),
}));
jest.mock('@/core/analytics', () => ({ initAnalytics: jest.fn(), track: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ initErrorReporting: jest.fn(), reportError: jest.fn() }));
// Abas nativas não existem no Jest: usamos um contêiner simples que mostra a aba atual.
jest.mock('expo-router/native-tabs', () => {
  const { Slot } = require('expo-router');
  const Trigger = Object.assign(() => null, { Label: () => null, Icon: () => null });
  return { NativeTabs: Object.assign(() => <Slot />, { Trigger }) };
});

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});

const user = (overrides: Partial<Extract<MockAuth, { status: 'signedIn' }>['user']> = {}) => ({
  status: 'signedIn' as const,
  user: { uid: 'u1', isAnonymous: false, email: 'ana@exemplo.com', displayName: 'Ana Souza', provider: 'password', ...overrides },
});

describe('navegação', () => {
  it('sem login, a primeira tela é a de boas-vindas', async () => {
    mockAuth = { status: 'signedOut', user: null };
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Continuar sem cadastro')).toBeTruthy();
    expect(screen.queryByText('Meus Pets')).toBeNull();
  });

  it('com login, abre a Home com os três atalhos e o card da veterinária', async () => {
    mockAuth = user();
    const result = await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Olá, Ana')).toBeTruthy();
    expect(result.getPathname()).toBe('/home');
    expect(screen.getByText('Meus Pets')).toBeTruthy();
    expect(screen.getByText('Resgatar')).toBeTruthy();
    expect(screen.getByText('Denunciar')).toBeTruthy();
    expect(screen.getByText('Veterinária mais próxima')).toBeTruthy();
  });

  it('sem login, uma rota protegida (/pets) não abre', async () => {
    mockAuth = { status: 'signedOut', user: null };
    const result = await renderRouter('./src/app', { initialUrl: '/pets' });
    expect(await screen.findByText('Continuar sem cadastro')).toBeTruthy();
    expect(result.getPathname()).not.toBe('/pets');
  });

  it('quem está sem cadastro (anônimo) vê o convite para criar conta em Pets', async () => {
    mockAuth = user({ isAnonymous: true, email: null, displayName: null, provider: 'anonymous' });
    await renderRouter('./src/app', { initialUrl: '/pets' });
    expect(await screen.findByText('Crie uma conta para cuidar do seu pet')).toBeTruthy();
  });

  it('com conta e sem pets, a aba Pets mostra o estado vazio', async () => {
    mockAuth = user();
    await renderRouter('./src/app', { initialUrl: '/pets' });
    expect(await screen.findByText('Nenhum pet por aqui ainda')).toBeTruthy();
  });

  it('Termos e Privacidade abrem mesmo sem login', async () => {
    mockAuth = { status: 'signedOut', user: null };
    await renderRouter('./src/app', { initialUrl: '/legal/privacy' });
    expect(await screen.findByText('Política de Privacidade')).toBeTruthy();
  });

  it('a tela de Resgate lembra do 190', async () => {
    mockAuth = user();
    await renderRouter('./src/app', { initialUrl: '/rescue' });
    expect(await screen.findByText(/ligue 190/)).toBeTruthy();
  });
});
