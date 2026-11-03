import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import LoginScreen from '@/app/login';

const mockSignIn = jest.fn();
jest.mock('@/features/auth/auth.service', () => ({
  signInWithEmail: (...args: unknown[]) => mockSignIn(...args),
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
beforeEach(() => mockSignIn.mockReset());

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

  it('oferece o login com Google', async () => {
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeTruthy();
  });
});
