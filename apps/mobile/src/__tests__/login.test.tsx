import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import LoginScreen from '@/app/login';

const mockSignIn = jest.fn();
const mockGoogleAvailable = jest.fn(() => true);
jest.mock('@/features/auth/auth.service', () => ({
  signInWithEmail: (...args: unknown[]) => mockSignIn(...args),
  isGoogleSignInAvailable: () => mockGoogleAvailable(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ refresh: jest.fn() }) }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
afterEach(() => jest.restoreAllMocks());
beforeEach(async () => {
  await AsyncStorage.clear();
  mockSignIn.mockReset();
  mockGoogleAvailable.mockReturnValue(true);
});

describe('LoginScreen', () => {
  it('valida e-mail e senha antes de chamar o servidor', async () => {
    await renderWithProviders(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect((await screen.findAllByText('Preencha este campo.')).length).toBe(2); // e-mail e senha
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('entra com e-mail e senha (e-mail sem espaços nas pontas)', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), '  ana@exemplo.com ');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith('ana@exemplo.com', 'senha1234'));
  });

  it('mostra uma mensagem que não revela se o e-mail existe', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/user-not-found' });
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ninguem@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'qualquer1');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeTruthy();
  });

  it('depois de erros seguidos, impõe uma espera crescente antes de tentar de novo', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' });
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada1');
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
      await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(i + 1));
    }
    // 2 erros livres; o 3º gera espera de 2 s: a 4ª tentativa nem chega ao servidor.
    expect(await screen.findByText(/Aguarde \d s para tentar de novo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(mockSignIn).toHaveBeenCalledTimes(3);
  });

  it('o e-mail nunca é guardado em texto: só um resumo (hash) com a contagem', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' });
    await renderWithProviders(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada1');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(async () => expect((await AsyncStorage.getAllKeys()).length).toBe(2));
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.join(' ')).not.toContain('ana@exemplo.com');
    expect(JSON.stringify(await AsyncStorage.multiGet(keys))).not.toContain('ana@');
  });

  it('oferece o login com Google', async () => {
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeTruthy();
  });

  it('sem Google configurado, no iOS só sobra o botão da Apple', async () => {
    mockGoogleAvailable.mockReturnValue(false);
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderWithProviders(<LoginScreen />);
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar com Apple' })).toBeTruthy();
  });

  it('sem Google configurado, no Android a seção de login social some por inteiro', async () => {
    mockGoogleAvailable.mockReturnValue(false);
    jest.replaceProperty(Platform, 'OS', 'android');
    await renderWithProviders(<LoginScreen />);
    expect(screen.queryByRole('button', { name: 'Continuar com Google' })).toBeNull();
    expect(screen.queryByText('ou entre com')).toBeNull();
  });
});
