import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import AdoptionDetailScreen from '@/app/adoption/[id]/index';
import NewAdoptionScreen from '@/app/adoption/new';
import NewReportScreen from '@/app/report/new';
import RescueGuideScreen from '@/app/rescue/guide';
import NewRescueAlertScreen from '@/app/rescue/new';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));

let mockUser = { uid: 'bia', isAnonymous: false, displayName: 'Bia' };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));

jest.mock('@/features/nearby/location', () => ({
  LocationError: class extends Error {},
  requestLocationPermission: jest.fn(async () => 'granted'),
  getLocationPermission: jest.fn(async () => 'undetermined'),
  getCurrentPosition: jest.fn(async () => ({ lat: -23.551234, lng: -46.634567 })),
  geocodeAddress: jest.fn(),
}));

// A fábrica do mock roda ANTES das constantes do arquivo (hoisting): as funções nascem aqui dentro.
jest.mock('@/features/centrals/centrals.repo', () => ({
  createAdoption: jest.fn(async () => ({ id: 'a1' })),
  updateAdoption: jest.fn(async () => ({ ok: true })),
  deleteAdoption: jest.fn(),
  createRescueAlert: jest.fn(async () => ({ id: 'r1' })),
  updateRescueAlert: jest.fn(),
  createReport: jest.fn(async () => ({ id: 'd1' })),
  attachReportPhotos: jest.fn(),
  uploadCentralPhotos: jest.fn(async () => []),
  getAdoptionContact: jest.fn(async () => '(19) 99999-0000'),
  subscribeAdoption: jest.fn(),
  getPhotoUrl: jest.fn(async () => 'file://x.jpg'),
}));
type Mocked = Record<
  'createAdoption' | 'updateAdoption' | 'createReport' | 'getAdoptionContact' | 'subscribeAdoption',
  jest.Mock
>;
const mockRepo = jest.requireMock('@/features/centrals/centrals.repo') as Mocked;

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(async () => {
  jest.clearAllMocks();
  mockRepo.createAdoption.mockResolvedValue({ id: 'a1' });
  mockRepo.createReport.mockResolvedValue({ id: 'd1' });
  mockRepo.getAdoptionContact.mockResolvedValue('(19) 99999-0000');
  mockParams = {};
  mockUser = { uid: 'bia', isAnonymous: false, displayName: 'Bia' };
  await AsyncStorage.clear();
});

describe('guia do resgate (4 etapas)', () => {
  it('começa na avaliação, marca itens (salvos no aparelho) e avança até o acolhimento', async () => {
    await renderWithProviders(<RescueGuideScreen />);
    expect(await screen.findByText('Avaliação e aproximação')).toBeTruthy();
    expect(screen.getByText(/NÃO tente pegar/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Garanta a sua segurança primeiro' }));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('rescue-guide-v1'))!).done).toEqual(['approach.safety']));

    await fireEvent.press(screen.getByTestId('guide-next'));
    expect(await screen.findByText('Atendimento veterinário')).toBeTruthy();
    expect(screen.getByText(/O app não indica medicamento nem dose/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('guide-step-3'));
    expect(await screen.findByText('Isolamento e quarentena')).toBeTruthy();
    expect(screen.getAllByText(/7 a 14 dias/).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId('guide-step-4'));
    expect(await screen.findByText('Acolhimento e pós-resgate')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Anunciar para adoção' }));
    expect(mockPush).toHaveBeenCalledWith('/adoption/new');
  });

  it('volta para a etapa em que a pessoa parou', async () => {
    await AsyncStorage.setItem('rescue-guide-v1', JSON.stringify({ step: 2, done: [] }));
    await renderWithProviders(<RescueGuideScreen />);
    expect(await screen.findByText('Isolamento e quarentena')).toBeTruthy();
  });
});

describe('denúncia', () => {
  it('não envia sem local e descrição; com tudo certo, envia anônima e mostra a confirmação', async () => {
    await renderWithProviders(<NewReportScreen />);
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByText('Defina onde aconteceu.')).toBeTruthy();
    expect(mockRepo.createReport).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Descreva o que você viu'), 'Cachorro sem água e comida há dias no quintal.');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    expect(await screen.findByTestId('location-set')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('report-submit'));

    await waitFor(() => expect(mockRepo.createReport).toHaveBeenCalledTimes(1));
    expect(mockRepo.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'neglect', anonymous: true, lat: -23.551234, lng: -46.634567, occurredOn: undefined }),
    );
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/report/[id]', params: { id: 'd1', created: '1' } });
  });

  it('mostra a mensagem do limite diário vinda do servidor', async () => {
    mockRepo.createReport.mockRejectedValueOnce(Object.assign(new Error('daily-limit'), { code: 'functions/resource-exhausted' }));
    await renderWithProviders(<NewReportScreen />);
    await fireEvent.changeText(screen.getByLabelText('Descreva o que você viu'), 'Cachorro sem água e comida há dias no quintal.');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    await screen.findByTestId('location-set');
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByText('Você atingiu o limite de registros de hoje. Tente amanhã.')).toBeTruthy();
  });
});

describe('alerta de resgate', () => {
  it('animal silvestre: avisa para não pegar e mostra o IBAMA', async () => {
    await renderWithProviders(<NewRescueAlertScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Ave silvestre' }));
    expect(await screen.findByText(/não tente pegar e ligue para o órgão ambiental/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'IBAMA Linha Verde (0800 061 8080)' })).toBeTruthy();
  });
});

describe('adoção', () => {
  it('publica um anúncio com saúde e contato e abre o anúncio criado', async () => {
    await renderWithProviders(<NewAdoptionScreen />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Caramelo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar vacina' }));
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'V10');
    await fireEvent.changeText(screen.getByLabelText('Descrição'), 'Muito dócil, se dá bem com crianças.');
    await fireEvent.changeText(screen.getByLabelText('Cidade'), 'Campinas');
    await fireEvent.changeText(screen.getByLabelText('UF'), 'SP');
    await fireEvent.changeText(screen.getByLabelText('Telefone ou WhatsApp para contato'), '(19) 99999-0000');
    await fireEvent.press(screen.getByTestId('adoption-submit'));

    await waitFor(() => expect(mockRepo.createAdoption).toHaveBeenCalledTimes(1));
    expect(mockRepo.createAdoption).toHaveBeenCalledWith(
      expect.objectContaining({ colors: ['caramel'], vaccines: [{ name: 'V10' }], city: 'Campinas', uf: 'SP', contactPhone: '(19) 99999-0000' }),
    );
    expect(mockRepo.updateAdoption).not.toHaveBeenCalled(); // sem fotos, nada a anexar
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/adoption/[id]', params: { id: 'a1' } });
  });

  it('quem não é dono vê o contato só ao pedir (com WhatsApp); o dono vê as ações do anúncio', async () => {
    const listing = {
      id: 'a1', ownerId: 'ana', status: 'available', species: 'cat', sex: 'female', ageGroup: 'young', colors: ['black'], neutered: 'yes',
      vaccines: [{ name: 'V4' }], medications: [], exams: [], description: 'Gatinha carinhosa', city: 'Campinas', uf: 'SP', photoPaths: [], createdAtMs: 0,
    };
    mockRepo.subscribeAdoption.mockImplementation((_id: string, ok: (l: unknown) => void) => {
      ok(listing);
      return () => undefined;
    });
    mockParams = { id: 'a1' };
    const { unmount } = await renderWithProviders(<AdoptionDetailScreen />);
    expect(await screen.findByText(/V4/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('adoption-contact'));
    expect(await screen.findByText('(19) 99999-0000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Conversar no WhatsApp' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Excluir anúncio' })).toBeNull();
    unmount();
  });

  it('o dono vê situação, editar e excluir', async () => {
    mockUser = { uid: 'ana', isAnonymous: false, displayName: 'Ana' };
    mockRepo.subscribeAdoption.mockImplementation((_id: string, ok: (l: unknown) => void) => {
      ok({ id: 'a1', ownerId: 'ana', status: 'available', species: 'dog', sex: 'male', ageGroup: 'adult', colors: ['white'], neutered: 'no', vaccines: [], medications: [], exams: [], description: 'Cão calmo e companheiro', city: 'Campinas', uf: 'SP', photoPaths: [], createdAtMs: 0 });
      return () => undefined;
    });
    mockParams = { id: 'a1' };
    await renderWithProviders(<AdoptionDetailScreen />);
    expect(await screen.findByRole('button', { name: 'Excluir anúncio' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Adotado' }));
    await waitFor(() => expect(mockRepo.updateAdoption).toHaveBeenCalledWith({ id: 'a1', status: 'adopted' }));
  });
});
