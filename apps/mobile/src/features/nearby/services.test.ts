import type { Place } from '@petcare/shared';
import { directionsLinks, formatDistance, phoneUrl } from './directions';
import { clearPlacesMemory, PlacesError, searchNearby } from './places.service';

const mockCall = jest.fn();
jest.mock('@/core/firebase/callable', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));

describe('Como chegar / Ligar / distância', () => {
  const to = { lat: -23.5614, lng: -46.6559 };

  it('Android: Google Maps e Waze; iPhone também Apple Maps — todos com o destino', () => {
    expect(directionsLinks(to, 'android').map((l) => l.app)).toEqual(['google', 'waze']);
    const ios = directionsLinks(to, 'ios');
    expect(ios.map((l) => l.app)).toEqual(['google', 'waze', 'apple']);
    for (const link of ios) expect(decodeURIComponent(link.url)).toContain('-23.5614,-46.6559');
    expect(ios[0]!.url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
    expect(ios[1]!.url).toMatch(/^https:\/\/waze\.com\/ul\?ll=.*&navigate=yes$/);
  });

  it('telefone vira link tel: só com dígitos (e o + do início)', () => {
    expect(phoneUrl('+55 (11) 3333-4444')).toBe('tel:+551133334444');
    expect(phoneUrl('11 3333-4444')).toBe('tel:1133334444');
    expect(phoneUrl('ramal 12')).toBeNull();
    expect(phoneUrl(undefined)).toBeNull();
  });

  it('distância legível', () => {
    expect(formatDistance(0.34, 'pt-BR')).toBe('340 m');
    expect(formatDistance(0.001, 'pt-BR')).toBe('10 m');
    expect(formatDistance(1.24, 'pt-BR')).toBe('1,2 km');
    expect(formatDistance(1.24, 'en')).toBe('1.2 km');
    expect(formatDistance(12.6, 'pt-BR')).toBe('13 km');
  });
});

describe('searchNearby', () => {
  const places: Place[] = [
    { id: 'osm:node/1', source: 'osm', name: 'Longe', category: 'vet', lat: -23.6, lng: -46.63, emergency: false },
    { id: 'osm:node/2', source: 'osm', name: 'Perto', category: 'vet', lat: -23.5505, lng: -46.6305, emergency: false },
  ];
  const exact = { lat: -23.550412, lng: -46.630587 };

  beforeEach(() => {
    jest.clearAllMocks();
    clearPlacesMemory();
    mockCall.mockResolvedValue({ places, provider: 'osm', cached: false });
  });

  it('PRIVACIDADE: manda para o servidor só a célula (~1 km), nunca a posição exata', async () => {
    await searchNearby(exact, 5);
    expect(mockCall).toHaveBeenCalledWith('searchPlaces', { lat: -23.55, lng: -46.63, radiusKm: 5 });
    expect(JSON.stringify(mockCall.mock.calls)).not.toContain('550412');
  });

  it('calcula a distância EXATA no aparelho', async () => {
    const result = await searchNearby(exact, 5);
    const perto = result.find((p) => p.name === 'Perto')!;
    expect(perto.distanceKm).toBeLessThan(0.1);
    expect(result.find((p) => p.name === 'Longe')!.distanceKm).toBeGreaterThan(5);
  });

  it('reaproveita o resultado por 10 minutos (mesma célula e raio); depois busca de novo', async () => {
    const t0 = 1_000_000;
    await searchNearby(exact, 5, t0);
    await searchNearby({ lat: -23.5521, lng: -46.6299 }, 5, t0 + 60_000); // vizinho, mesma célula
    expect(mockCall).toHaveBeenCalledTimes(1);
    await searchNearby(exact, 10, t0 + 60_000); // outro raio
    expect(mockCall).toHaveBeenCalledTimes(2);
    await searchNearby(exact, 5, t0 + 11 * 60_000);
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it('erros: serviço de mapas fora do ar, sem conexão e resposta estranha', async () => {
    mockCall.mockRejectedValueOnce(Object.assign(new Error('places-unavailable'), { code: 'functions/unavailable' }));
    await expect(searchNearby(exact, 5)).rejects.toMatchObject({ code: 'unavailable' });
    mockCall.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(searchNearby(exact, 5)).rejects.toMatchObject({ code: 'network' });
    mockCall.mockResolvedValueOnce({ places: 'x' });
    await expect(searchNearby(exact, 5)).rejects.toBeInstanceOf(PlacesError);
  });
});
