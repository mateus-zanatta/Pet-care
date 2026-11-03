import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { renderWithProviders, setupTestI18n } from '@/test/render';
import { takeScannedCode } from '@/features/medications/scanInbox';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }), useFocusEffect: jest.fn() }));

let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();
let mockOnScanned: ((r: { data: string }) => void) | undefined;
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
  CameraView: (props: { onBarcodeScanned?: (r: { data: string }) => void }) => {
    const { Text } = require('react-native');
    mockOnScanned = props.onBarcodeScanned;
    return <Text>camera</Text>;
  },
}));

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  takeScannedCode();
  mockPermission = { granted: true, canAskAgain: true };
  mockOnScanned = undefined;
});

const loadScreen = () => require('@/app/pet/[id]/medications/scan').default as React.ComponentType;

describe('leitura do código de barras', () => {
  it('lê o primeiro código, guarda para o formulário e volta — leituras repetidas são ignoradas', async () => {
    const Screen = loadScreen();
    await renderWithProviders(<Screen />);
    expect(screen.getByText('Aponte a câmera para o código de barras da embalagem.')).toBeTruthy();

    mockOnScanned!({ data: ' 7891234567895 ' });
    mockOnScanned!({ data: '0000000000000' });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(takeScannedCode()).toBe('7891234567895');
    expect(takeScannedCode()).toBeNull(); // entregue uma única vez
  });

  it('limita o código a 64 caracteres (o tamanho do campo)', async () => {
    const Screen = loadScreen();
    await renderWithProviders(<Screen />);
    mockOnScanned!({ data: 'x'.repeat(200) });
    expect(takeScannedCode()).toHaveLength(64);
  });

  it('sem permissão: explica para que serve a câmera e pede', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    const Screen = loadScreen();
    await renderWithProviders(<Screen />);
    expect(screen.getByText(/só é usada para ler o código de barras/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Permitir câmera' }));
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('permissão negada de vez: leva às configurações; "Digitar manualmente" volta', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockPermission = { granted: false, canAskAgain: false };
    const Screen = loadScreen();
    await renderWithProviders(<Screen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir configurações' }));
    expect(openSettings).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Digitar manualmente' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
