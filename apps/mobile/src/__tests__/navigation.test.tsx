import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
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
jest.mock('@/core/firebase', () => ({ connectEmulatorsIfEnabled: jest.fn().mockResolvedValue(undefined), isUsingEmulators: () => false }));
jest.mock('@/features/pets/pets.repo', () => ({
  subscribeMemberships: (_uid: string, onData: (m: unknown[]) => void) => {
    onData([]);
    return () => undefined;
  },
  subscribePet: jest.fn(() => () => undefined),
  getPhotoUrl: jest.fn(),
}));
jest.mock('@/features/medications/medications.repo', () => ({
  subscribeMedications: jest.fn(() => () => undefined),
  subscribeDoseLogs: jest.fn(() => () => undefined),
  logDose: jest.fn(),
  undoDose: jest.fn(),
  createMedication: jest.fn(),
  updateMedication: jest.fn(),
  setMedicationStatus: jest.fn(),
  deleteMedication: jest.fn(),
}));
jest.mock('@/features/health/health.repo', () => ({
  subscribeVaccines: jest.fn(() => () => undefined),
  subscribeHealthEvents: jest.fn(() => () => undefined),
  createVaccine: jest.fn(),
  updateVaccine: jest.fn(),
  deleteVaccine: jest.fn(),
  createHealthEvent: jest.fn(),
  updateHealthEvent: jest.fn(),
  deleteHealthEvent: jest.fn(),
}));
jest.mock('@/features/health/report', () => ({ exportHealthReport: jest.fn(), isPdfExportAvailable: () => true }));
jest.mock('@/features/attachments/attachments.service', () => ({
  AttachmentError: class extends Error {},
  addAttachment: jest.fn(),
  removeAttachment: jest.fn(),
  openAttachment: jest.fn(),
  pickPdf: jest.fn(),
  deleteAllAttachmentFiles: jest.fn(),
}));
// Perto de mim: sem GPS nem Firebase no Jest.
jest.mock('@/features/nearby/location', () => ({
  LocationError: class extends Error {},
  isLocationAvailable: () => true,
  getLocationPermission: jest.fn(async () => 'undetermined'),
  requestLocationPermission: jest.fn(async () => 'undetermined'),
  getCurrentPosition: jest.fn(),
  geocodeAddress: jest.fn(),
}));
jest.mock('@/features/nearby/places.service', () => ({ PlacesError: class extends Error {}, searchNearby: jest.fn() }));
// Centrais (adoção, resgate, denúncia): leitura do Firestore vazia nos testes de navegação.
jest.mock('@/features/centrals/centrals.repo', () => {
  const none = () => () => undefined;
  return {
    subscribeAdoptions: jest.fn((ok: (x: unknown[]) => void) => { ok([]); return () => undefined; }),
    subscribeMyAdoptions: jest.fn(none),
    subscribeAdoption: jest.fn(none),
    subscribeOpenRescueAlerts: jest.fn((ok: (x: unknown[]) => void) => { ok([]); return () => undefined; }),
    subscribeRescueAlert: jest.fn(none),
    subscribeMyReports: jest.fn((_uid: string, ok: (x: unknown[]) => void) => { ok([]); return () => undefined; }),
    subscribeReport: jest.fn(none),
    getPhotoUrl: jest.fn(async () => 'file://x.jpg'),
  };
});
jest.mock('@/features/nearby/favorites.repo', () => ({
  subscribeFavorites: jest.fn(() => () => undefined),
  addFavorite: jest.fn(),
  removeFavorite: jest.fn(),
}));
// Lembretes (notificações nativas) não existem no Jest.
jest.mock('@/features/reminders/ReminderSync', () => ({ ReminderSync: () => null }));
jest.mock('@/features/reminders/NotificationBridge', () => ({ NotificationBridge: () => null }));
jest.mock('@/features/reminders/usePermission', () => ({
  useReminderPermission: () => ({ state: 'granted', request: jest.fn() }),
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
  it('a abertura segue o caminho NORMAL (não cai no plano B de emergência)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockAuth = { status: 'signedOut', user: null };
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Continuar sem cadastro')).toBeTruthy();
    expect(warn.mock.calls.filter(([message]) => String(message).startsWith('[boot]'))).toEqual([]);
    warn.mockRestore();
  });

  it('sem login, a primeira tela é a de boas-vindas', async () => {
    mockAuth = { status: 'signedOut', user: null };
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Continuar sem cadastro')).toBeTruthy();
    expect(screen.queryByText('Meus Pets')).toBeNull();
  });

  it('com login, abre a Home com os atalhos das centrais e o card da veterinária', async () => {
    mockAuth = user();
    const result = await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Olá, Ana')).toBeTruthy();
    expect(result.getPathname()).toBe('/home');
    expect(screen.getByText('Meus Pets')).toBeTruthy();
    expect(screen.getByText('Adoção')).toBeTruthy();
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

  it('a Central de Resgate mostra os contatos oficiais (190, 193 e IBAMA) e o guia passo a passo', async () => {
    mockAuth = user();
    await renderRouter('./src/app', { initialUrl: '/rescue' });
    expect(await screen.findByRole('button', { name: 'Polícia / Polícia Ambiental (190)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bombeiros (193)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'IBAMA Linha Verde (0800 061 8080)' })).toBeTruthy();
    expect(screen.getByTestId('rescue-guide')).toBeTruthy();
    expect(screen.getByText('Nenhum alerta aberto')).toBeTruthy();
  });

  it('da Home, os atalhos abrem as centrais de Adoção e de Denúncia', async () => {
    mockAuth = user();
    await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('shortcut-adoption'));
    expect(await screen.findByText('Anunciar um animal para adoção')).toBeTruthy();
  });

  it('a Central de Denúncias lembra do 190 e mostra os canais oficiais', async () => {
    mockAuth = user();
    await renderRouter('./src/app', { initialUrl: '/report' });
    expect(await screen.findByText('Está acontecendo agora? Ligue 190 imediatamente.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Disque Denúncia (181, anônimo)' })).toBeTruthy();
    expect(screen.getByText('Você ainda não fez nenhuma denúncia pelo app.')).toBeTruthy();
  });

  it('sem cadastro (anônimo), as centrais convidam a criar conta em vez de deixar anunciar ou denunciar', async () => {
    mockAuth = user({ isAnonymous: true, email: null, displayName: null, provider: 'anonymous' });
    await renderRouter('./src/app', { initialUrl: '/report' });
    expect(await screen.findByText('Crie sua conta para participar')).toBeTruthy();
    expect(screen.queryByTestId('report-new')).toBeNull();
  });

  it('do Resgate, um toque abre o Perto de mim no modo emergência (24 h primeiro)', async () => {
    mockAuth = user({ isAnonymous: true, email: null, displayName: null, provider: 'anonymous' });
    await renderRouter('./src/app', { initialUrl: '/rescue' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver atendimento de emergência perto de mim' }));
    expect(await screen.findByText('Mostrando primeiro os atendimentos de emergência e 24 h.')).toBeTruthy();
  });

  it('a aba Perto de mim abre explicando e oferecendo localização ou endereço (sem cadastro também)', async () => {
    mockAuth = user({ isAnonymous: true, email: null, displayName: null, provider: 'anonymous' });
    await renderRouter('./src/app', { initialUrl: '/nearby' });
    expect(await screen.findByRole('button', { name: 'Usar minha localização' })).toBeTruthy();
    expect(screen.getByLabelText('Ou digite um endereço, bairro ou cidade')).toBeTruthy();
    expect(screen.getByText(/colaboradores do OpenStreetMap/)).toBeTruthy();
  });
});
