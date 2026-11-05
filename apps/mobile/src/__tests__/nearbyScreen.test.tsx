import type { FavoritePlace, PlaceWithDistance } from '@petcare/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { NearbyScreen } from '@/features/nearby/NearbyScreen';
import { renderWithProviders, setupTestI18n } from '@/test/render';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
// Segunda-feira, 02/11/2026, 15:00 (relógio local).
jest.mock('@/core/time/useNow', () => ({ useNow: () => new Date(2026, 10, 2, 15, 0) }));
jest.mock('@/core/analytics', () => ({ track: jest.fn() }));
jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));

let mockUser: { uid: string; isAnonymous: boolean } | null = { uid: 'u1', isAnonymous: false };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: mockUser, status: 'signedIn' }) }));

const mockPermission = jest.fn();
const mockRequest = jest.fn();
const mockPosition = jest.fn();
const mockGeocode = jest.fn();
jest.mock('@/features/nearby/location', () => {
  class LocationError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return {
    LocationError,
    getLocationPermission: () => mockPermission(),
    requestLocationPermission: () => mockRequest(),
    getCurrentPosition: () => mockPosition(),
    geocodeAddress: (t: string) => mockGeocode(t),
  };
});

const mockSearch = jest.fn();
jest.mock('@/features/nearby/places.service', () => {
  class PlacesError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { PlacesError, searchNearby: (...a: unknown[]) => mockSearch(...a) };
});

let mockFavorites: FavoritePlace[] = [];
const mockAdd = jest.fn();
const mockRemove = jest.fn();
jest.mock('@/features/nearby/favorites.repo', () => ({
  subscribeFavorites: (_uid: string, onData: (f: FavoritePlace[]) => void) => {
    onData(mockFavorites);
    return () => undefined;
  },
  addFavorite: (...a: unknown[]) => mockAdd(...a),
  removeFavorite: (...a: unknown[]) => mockRemove(...a),
}));
jest.mock('@/features/nearby/NearbyMap', () => ({ isMapAvailable: () => false, NearbyMap: () => null }));

const here = { lat: -23.55, lng: -46.63 };
const place = (id: string, over: Partial<PlaceWithDistance>): PlaceWithDistance => ({
  id: `osm:node/${id}`, source: 'osm', category: 'vet', lat: -23.55, lng: -46.63, emergency: false, distanceKm: 1, ...over,
});
const results: PlaceWithDistance[] = [
  place('2', { name: 'Hospital 24h', emergency: true, openingHours: '24/7', distanceKm: 3.2 }),
  place('1', { name: 'Clínica Perto', phone: '+55 11 3333-4444', openingHours: 'Mo-Fr 08:00-18:00', address: 'Rua A, 10', distanceKm: 0.4 }),
  place('3', { name: 'Pet Shop Feliz', category: 'petshop', openingHours: 'Mo-Fr 08:00-12:00', distanceKm: 1.1 }),
];

beforeAll(async () => {
  await setupTestI18n('pt-BR');
});
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { uid: 'u1', isAnonymous: false };
  mockFavorites = [];
  mockPermission.mockResolvedValue('undetermined');
  mockRequest.mockResolvedValue('granted');
  mockPosition.mockResolvedValue(here);
  mockSearch.mockResolvedValue(results);
  mockAdd.mockResolvedValue('committed');
  mockRemove.mockResolvedValue('committed');
});

const names = () => screen.getAllByTestId(/^place-/).map((n) => n.props.testID);

describe('Perto de mim', () => {
  it('sem permissão ainda: explica, pede só ao tocar, e lista do mais perto ao mais longe', async () => {
    await renderWithProviders(<NearbyScreen />);
    expect(await screen.findByText(/Sua localização exata não sai do celular/)).toBeTruthy();
    expect(mockRequest).not.toHaveBeenCalled(); // nada de pedir permissão sem a pessoa tocar
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(here, 5));
    expect(await screen.findByText('Perto de você')).toBeTruthy();
    expect(names()).toEqual(['place-osm:node/1', 'place-osm:node/3', 'place-osm:node/2']);
    expect(screen.getByText('3 locais em até 5 km')).toBeTruthy();
    expect(screen.getByText('Clínica veterinária · 400 m de você')).toBeTruthy();
  });

  it('com permissão já dada, busca sozinho ao abrir', async () => {
    mockPermission.mockResolvedValue('granted');
    await renderWithProviders(<NearbyScreen />);
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(here, 5));
    expect(mockRequest).not.toHaveBeenCalled();
    expect(await screen.findByText('Clínica Perto')).toBeTruthy();
  });

  it('localização bloqueada: leva às configurações e aceita um endereço digitado', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockPermission.mockResolvedValue('denied');
    mockGeocode.mockResolvedValue({ lat: -23.56, lng: -46.65 });
    await renderWithProviders(<NearbyScreen />);
    expect(await screen.findByText(/A localização está bloqueada para o app/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir configurações' }));
    expect(openSettings).toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Ou digite um endereço, bairro ou cidade'), 'Av. Paulista, São Paulo');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar endereço' }));
    await waitFor(() => expect(mockSearch).toHaveBeenCalledWith({ lat: -23.56, lng: -46.65 }, 5));
    expect(mockGeocode).toHaveBeenCalledWith('Av. Paulista, São Paulo');
    expect(await screen.findByText('Perto de: Av. Paulista, São Paulo')).toBeTruthy();
  });

  it('endereço não encontrado: explica', async () => {
    const { LocationError } = jest.requireMock('@/features/nearby/location');
    mockGeocode.mockRejectedValue(new LocationError('not-found'));
    await renderWithProviders(<NearbyScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Ou digite um endereço, bairro ou cidade'), 'xyzxyz');
    await fireEvent.press(screen.getByRole('button', { name: 'Buscar endereço' }));
    expect(await screen.findByText(/Não encontramos esse endereço/)).toBeTruthy();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('GPS desligado: explica e mantém a opção de endereço', async () => {
    const { LocationError } = jest.requireMock('@/features/nearby/location');
    mockPosition.mockRejectedValue(new LocationError('services-off'));
    await renderWithProviders(<NearbyScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar minha localização' }));
    expect(await screen.findByText(/A localização do celular está desligada/)).toBeTruthy();
    expect(screen.getByLabelText('Ou digite um endereço, bairro ou cidade')).toBeTruthy();
  });

  describe('com resultados', () => {
    beforeEach(() => mockPermission.mockResolvedValue('granted'));

    it('filtros: tipo, emergência/24 h e aberto agora (segunda, 15h)', async () => {
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      await fireEvent.press(screen.getByRole('radio', { name: 'Pet shop' }));
      expect(names()).toEqual(['place-osm:node/3']);
      await fireEvent.press(screen.getByRole('radio', { name: 'Todos' }));
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Emergência/24 h' }));
      expect(names()).toEqual(['place-osm:node/2']);
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Emergência/24 h' }));
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Aberto agora' }));
      expect(names()).toEqual(['place-osm:node/1', 'place-osm:node/2']); // o pet shop fecha ao meio-dia
    });

    it('mostra se está aberto, o horário e o aviso de emergência', async () => {
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      expect(screen.getAllByText('Aberto agora').length).toBeGreaterThan(0);
      expect(screen.getByText('Fechado agora')).toBeTruthy();
      expect(screen.getByText('Horário: Mo-Fr 08:00-18:00')).toBeTruthy();
      expect(screen.getAllByText('Emergência/24 h').length).toBeGreaterThan(0);
    });

    it('Ligar abre o discador; Como chegar oferece Google Maps e Waze (e Apple Maps no iPhone)', async () => {
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      await fireEvent.press(screen.getByRole('button', { name: 'Ligar' }));
      expect(openURL).toHaveBeenCalledWith('tel:+551133334444');

      await fireEvent.press(screen.getAllByRole('button', { name: 'Como chegar' })[0]!);
      const options = alert.mock.calls[0]![2]!;
      // No iPhone também aparece o Apple Maps (o ambiente de teste simula a plataforma do jest-expo).
      const expected = Platform.OS === 'ios' ? ['Google Maps', 'Waze', 'Apple Maps', 'Cancelar'] : ['Google Maps', 'Waze', 'Cancelar'];
      expect(options.map((o) => o.text)).toEqual(expected);
      options.find((o) => o.text === 'Waze')!.onPress!();
      expect(openURL).toHaveBeenLastCalledWith(expect.stringMatching(/^https:\/\/waze\.com\/ul\?ll=/));
    });

    it('favoritar (conta registrada) guarda o local; local sem nome usaria o tipo', async () => {
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      await fireEvent.press(screen.getByRole('button', { name: 'Favoritar Clínica Perto' }));
      await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'osm:node/1' }), 'Clínica veterinária'));
    });

    it('já favorito: o botão remove; e "Só favoritos" lista os favoritos', async () => {
      mockFavorites = [{ id: 'u1_osm-node-9', ownerId: 'u1', placeId: 'osm:node/9', source: 'osm', name: 'Minha Clínica', category: 'vet', lat: -23.55, lng: -46.63, emergency: false }];
      mockSearch.mockResolvedValue([...results, place('9', { name: 'Minha Clínica', distanceKm: 2 })]);
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      await fireEvent.press(screen.getByRole('button', { name: 'Remover Minha Clínica dos favoritos' }));
      await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('u1', 'osm:node/9'));
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Só favoritos' }));
      expect(names()).toEqual(['place-osm:node/9']);
    });

    it('"Corrigir dados" abre a sugestão já preenchida', async () => {
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      await fireEvent.press(screen.getAllByRole('button', { name: 'Corrigir dados' })[0]!);
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/nearby/suggest',
        params: { kind: 'fix', placeId: 'osm:node/1', name: 'Clínica Perto', category: 'vet', address: 'Rua A, 10', phone: '+55 11 3333-4444' },
      });
    });

    it('sem cadastro: usa normalmente, mas sem favoritar nem sugerir', async () => {
      mockUser = { uid: 'anon', isAnonymous: true };
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      expect(screen.queryByRole('button', { name: 'Favoritar Clínica Perto' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Sugerir um local' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Ligar' })).toBeTruthy();
    });

    it('poucos resultados: oferece ampliar a busca para o próximo raio', async () => {
      await renderWithProviders(<NearbyScreen />);
      await screen.findByText('Clínica Perto');
      await fireEvent.press(screen.getByRole('button', { name: 'Ampliar a busca para 10 km' }));
      await waitFor(() => expect(mockSearch).toHaveBeenLastCalledWith(here, 10));
    });

    it('erro de conexão: explica', async () => {
      const { PlacesError } = jest.requireMock('@/features/nearby/places.service');
      mockSearch.mockRejectedValueOnce(new PlacesError('network'));
      await renderWithProviders(<NearbyScreen />);
      expect(await screen.findByText(/Sem conexão com o servidor/)).toBeTruthy();
    });

    it('modo Resgate: avisa, começa com 10 km e põe emergência/24 h primeiro', async () => {
      await renderWithProviders(<NearbyScreen mode="emergency" />);
      expect(await screen.findByText('Mostrando primeiro os atendimentos de emergência e 24 h.')).toBeTruthy();
      await waitFor(() => expect(mockSearch).toHaveBeenCalledWith(here, 10));
      await screen.findByText('Hospital 24h');
      expect(names()[0]).toBe('place-osm:node/2');
    });

    it('mostra a atribuição exigida pela licença do OpenStreetMap', async () => {
      await renderWithProviders(<NearbyScreen />);
      expect(await screen.findByText(/Dados © colaboradores do OpenStreetMap/)).toBeTruthy();
    });
  });
});
