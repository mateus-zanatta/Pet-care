import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import ScanBarcodeScreen from '@/app/pet/[id]/medications/scan';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }), useFocusEffect: jest.fn() }));
// Simula um build ANTIGO do app: o módulo nativo da câmera não existe.
jest.mock('expo-camera', () => {
  throw new Error("Cannot find native module 'ExpoCamera'");
});

beforeAll(async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  await setupTestI18n('pt-BR');
});

describe('leitura do código de barras em build sem o módulo da câmera', () => {
  it('não quebra o app: avisa e deixa voltar para digitar', async () => {
    await renderWithProviders(<ScanBarcodeScreen />);
    expect(screen.getByText(/A leitura por câmera não está disponível nesta versão/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Digitar manualmente' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
