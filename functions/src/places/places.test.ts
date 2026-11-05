import type { Place } from '@petcare/shared';
import { HttpsError } from 'firebase-functions/v2/https';
import { describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, cacheKey, type CacheEntry, type PlacesCache } from './cache';
import { GooglePlacesProvider } from './googleProvider';
import { buildOverpassQuery, normalizeOverpass, OverpassProvider } from './overpass';
import { type PlacesProvider, ProviderError } from './provider';
import { handleSearchPlaces, providerFromEnv } from './searchPlaces';

const center = { lat: -23.55, lng: -46.63 };

/** Resposta do Overpass no formato real (valores fictícios). */
const overpassJson = {
  elements: [
    { type: 'node', id: 1, lat: -23.551, lon: -46.631, tags: { amenity: 'veterinary', name: 'Clínica Perto', opening_hours: 'Mo-Fr 08:00-18:00', phone: '+55 11 3333-4444;+55 11 5555-6666', 'addr:street': 'Rua A', 'addr:housenumber': '10', 'addr:city': 'São Paulo' } },
    { type: 'way', id: 2, center: { lat: -23.56, lon: -46.64 }, tags: { amenity: 'veterinary', name: 'Hospital Veterinário 24h' } },
    { type: 'node', id: 3, lat: -23.552, lon: -46.632, tags: { shop: 'pet', name: 'Pet Shop Feliz', website: 'https://exemplo.com' } },
    { type: 'node', id: 4, lat: -23.6, lon: -46.7, tags: { amenity: 'animal_shelter', name: 'Abrigo Esperança', opening_hours: '24/7' } },
    { type: 'node', id: 5, lat: -23.553, lon: -46.633, tags: { amenity: 'veterinary' } }, // sem nome
    { type: 'node', id: 6, lat: -23.554, lon: -46.634, tags: { amenity: 'veterinary', name: 'Clínica Emergencial', emergency: 'yes' } },
    { type: 'node', id: 7, lat: -23.55, lon: -46.63, tags: { amenity: 'pharmacy', name: 'Farmácia (fora do escopo)' } },
    { type: 'node', id: 8, tags: { amenity: 'veterinary', name: 'Sem coordenadas' } },
    { type: 'node', id: 9, lat: -23.555, lon: -46.635 }, // sem marcações
  ],
};

describe('consulta ao Overpass', () => {
  it('busca veterinárias, pet shops e abrigos no raio pedido, com limite', () => {
    const q = buildOverpassQuery(center, 5);
    expect(q).toContain('nwr["amenity"="veterinary"](around:5000,-23.55,-46.63);');
    expect(q).toContain('nwr["shop"="pet"](around:5000,-23.55,-46.63);');
    expect(q).toContain('nwr["amenity"="animal_shelter"](around:5000,-23.55,-46.63);');
    expect(q).toContain('[out:json]');
    expect(q).toMatch(/out center tags qt \d+;/);
  });
});

describe('conversão da resposta (normalizeOverpass)', () => {
  const places = normalizeOverpass(overpassJson, center);
  const byId = (id: string) => places.find((p) => p.id === id)!;

  it('mantém só os tipos do app e descarta itens sem coordenadas ou sem marcações', () => {
    expect(places.map((p) => p.id).sort()).toEqual(['osm:node/1', 'osm:node/3', 'osm:node/4', 'osm:node/5', 'osm:node/6', 'osm:way/2'].sort());
  });

  it('ordena do mais próximo ao mais distante do centro', () => {
    expect(places[0]!.id).toBe('osm:node/1');
    expect(places[places.length - 1]!.id).toBe('osm:node/4');
  });

  it('tipos, endereço montado, 1º telefone, site e horário', () => {
    expect(byId('osm:node/1')).toMatchObject({
      category: 'vet', name: 'Clínica Perto', address: 'Rua A, 10 - São Paulo', phone: '+55 11 3333-4444', openingHours: 'Mo-Fr 08:00-18:00', emergency: false, source: 'osm',
    });
    expect(byId('osm:node/3')).toMatchObject({ category: 'petshop', website: 'https://exemplo.com' });
    expect(byId('osm:node/4').category).toBe('shelter');
  });

  it('usa o centro de áreas (ways) como posição', () => {
    expect(byId('osm:way/2')).toMatchObject({ lat: -23.56, lng: -46.64 });
  });

  it('marca emergência por 24/7, emergency=yes ou nome ("24h", "emergência"...)', () => {
    expect(byId('osm:way/2').emergency).toBe(true); // "24h" no nome
    expect(byId('osm:node/6').emergency).toBe(true); // emergency=yes
    expect(byId('osm:node/4').emergency).toBe(true); // 24/7
    expect(byId('osm:node/1').emergency).toBe(false);
  });

  it('local sem nome continua (o app mostra o tipo), sem inventar nome', () => {
    expect(byId('osm:node/5').name).toBeUndefined();
  });

  it('resposta estranha vira erro claro', () => {
    expect(() => normalizeOverpass({ foo: 1 }, center)).toThrow(ProviderError);
  });

  it('limita a 150 locais', () => {
    const many = { elements: Array.from({ length: 300 }, (_, i) => ({ type: 'node', id: i, lat: -23.55 + i / 10000, lon: -46.63, tags: { amenity: 'veterinary' } })) };
    expect(normalizeOverpass(many, center)).toHaveLength(150);
  });
});

describe('OverpassProvider', () => {
  const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });

  it('envia a consulta por POST, com identificação do app', async () => {
    const fetchImpl = vi.fn(async () => ok(overpassJson));
    const places = await new OverpassProvider(fetchImpl, ['https://a.example/api']).search({ center, radiusKm: 5 });
    expect(places.length).toBeGreaterThan(0);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe('https://a.example/api');
    expect(init.method).toBe('POST');
    expect(init.headers['user-agent']).toMatch(/PetCare/);
    expect(decodeURIComponent(init.body)).toContain('around:5000,-23.55,-46.63');
  });

  it('servidor sobrecarregado (429) ou fora do ar: tenta o próximo', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok(overpassJson));
    const places = await new OverpassProvider(fetchImpl, ['a', 'b', 'c']).search({ center, radiusKm: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(places.length).toBeGreaterThan(0);
  });

  it('todos falham: erro "unavailable"', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 504, json: async () => ({}) }));
    await expect(new OverpassProvider(fetchImpl, ['a', 'b']).search({ center, radiusKm: 3 })).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('provedores', () => {
  it('OpenStreetMap é o padrão; Google ainda não configurado dá erro claro', async () => {
    expect(providerFromEnv(undefined).id).toBe('osm');
    expect(providerFromEnv('osm').id).toBe('osm');
    expect(providerFromEnv('google').id).toBe('google');
    await expect(new GooglePlacesProvider().search()).rejects.toMatchObject({ code: 'not-configured' });
  });
});

/* ------------------------------- handleSearchPlaces ------------------------------- */

const samplePlaces: Place[] = [{ id: 'osm:node/1', source: 'osm', name: 'Clínica', category: 'vet', lat: -23.55, lng: -46.63, emergency: false }];

function memoryCache(initial: Record<string, CacheEntry> = {}) {
  const store = new Map(Object.entries(initial));
  const cache: PlacesCache & { store: Map<string, CacheEntry> } = {
    store,
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => {
      store.set(k, v);
    },
  };
  return cache;
}

function fakeProvider(result: Place[] | Error): PlacesProvider & { search: ReturnType<typeof vi.fn> } {
  return {
    id: 'osm',
    search: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

const now = new Date('2026-11-04T12:00:00.000Z');

describe('handleSearchPlaces', () => {
  it('valida a entrada (raio fora da lista, coordenadas inválidas)', async () => {
    const deps = { provider: fakeProvider(samplePlaces), cache: memoryCache(), now };
    await expect(handleSearchPlaces({ lat: -23.5, lng: -46.6, radiusKm: 7 }, deps)).rejects.toBeInstanceOf(HttpsError);
    await expect(handleSearchPlaces({ lat: 200, lng: -46.6, radiusKm: 5 }, deps)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('PRIVACIDADE: arredonda a posição na grade ANTES de consultar (mesmo que venha exata)', async () => {
    const provider = fakeProvider(samplePlaces);
    await handleSearchPlaces({ lat: -23.551234, lng: -46.634567, radiusKm: 5 }, { provider, cache: memoryCache(), now });
    expect(provider.search).toHaveBeenCalledWith({ center: { lat: -23.55, lng: -46.63 }, radiusKm: 5 });
  });

  it('sem cache: consulta o provedor e guarda no cache', async () => {
    const cache = memoryCache();
    const res = await handleSearchPlaces({ lat: -23.55, lng: -46.63, radiusKm: 5 }, { provider: fakeProvider(samplePlaces), cache, now });
    expect(res).toEqual({ places: samplePlaces, provider: 'osm', cached: false });
    expect(cache.store.get(cacheKey('osm', center, 5))?.places).toEqual(samplePlaces);
  });

  it('cache recente (< 24 h): não consulta o provedor', async () => {
    const provider = fakeProvider(new Error('não deveria chamar'));
    const cache = memoryCache({ [cacheKey('osm', center, 5)]: { places: samplePlaces, provider: 'osm', fetchedAt: new Date(now.getTime() - 60_000) } });
    const res = await handleSearchPlaces({ lat: -23.5512, lng: -46.6299, radiusKm: 5 }, { provider, cache, now });
    expect(res.cached).toBe(true);
    expect(provider.search).not.toHaveBeenCalled();
  });

  it('cache vencido: consulta de novo', async () => {
    const provider = fakeProvider(samplePlaces);
    const cache = memoryCache({ [cacheKey('osm', center, 5)]: { places: [], provider: 'osm', fetchedAt: new Date(now.getTime() - CACHE_TTL_MS - 1) } });
    const res = await handleSearchPlaces({ lat: -23.55, lng: -46.63, radiusKm: 5 }, { provider, cache, now });
    expect(res).toMatchObject({ cached: false, places: samplePlaces });
  });

  it('provedor fora do ar: usa um resultado antigo (até 7 dias) em vez de deixar sem nada', async () => {
    const cache = memoryCache({ [cacheKey('osm', center, 5)]: { places: samplePlaces, provider: 'osm', fetchedAt: new Date(now.getTime() - 3 * CACHE_TTL_MS) } });
    const res = await handleSearchPlaces({ lat: -23.55, lng: -46.63, radiusKm: 5 }, { provider: fakeProvider(new ProviderError('unavailable')), cache, now });
    expect(res).toEqual({ places: samplePlaces, provider: 'osm', cached: true });
  });

  it('avisa o motivo técnico da falha do provedor (para o log do servidor), sem coordenadas', async () => {
    const onProviderError = vi.fn();
    await expect(
      handleSearchPlaces({ lat: -23.551234, lng: -46.634567, radiusKm: 5 }, { provider: fakeProvider(new ProviderError('unavailable', 'HTTP 429')), cache: memoryCache(), now, onProviderError }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(onProviderError).toHaveBeenCalledTimes(1);
    expect(String((onProviderError.mock.calls[0]![0] as Error).message)).toBe('unavailable: HTTP 429');
  });

  it('provedor fora do ar e sem cache: erro "unavailable" para o app explicar', async () => {
    await expect(
      handleSearchPlaces({ lat: -23.55, lng: -46.63, radiusKm: 5 }, { provider: fakeProvider(new ProviderError('unavailable')), cache: memoryCache(), now }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('cache com defeito não derruba a busca', async () => {
    const broken: PlacesCache = { get: async () => { throw new Error('x'); }, set: async () => { throw new Error('y'); } };
    const res = await handleSearchPlaces({ lat: -23.55, lng: -46.63, radiusKm: 5 }, { provider: fakeProvider(samplePlaces), cache: broken, now });
    expect(res.places).toEqual(samplePlaces);
  });
});
