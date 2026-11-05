import { describe, expect, it } from 'vitest';
import { distanceKm, gridKey, isValidLatLng, snapToGrid } from './geo';
import { filterAndSort, NO_FILTERS, withDistance } from './nearby';
import { isAlwaysOpen, isOpenAt, parseOpeningHours } from './openingHours';
import {
  favoritePlaceId,
  placeDocKey,
  placeSchema,
  placeSuggestionFormSchema,
  searchPlacesRequestSchema,
  suggestionFormToRequest,
  type Place,
} from './schemas/place';

/** Data LOCAL: 2026-11-02 é segunda-feira. */
const at = (day: number, hh: number, mm = 0) => new Date(2026, 10, 1 + day, hh, mm);
const MON = 1, TUE = 2, SAT = 6, SUN = 7;

describe('geo', () => {
  it('distância: Praça da Sé -> Av. Paulista (SP) ~ 2,6 km', () => {
    const se = { lat: -23.5503, lng: -46.6339 };
    const masp = { lat: -23.5614, lng: -46.6559 };
    expect(distanceKm(se, masp)).toBeGreaterThan(2.4);
    expect(distanceKm(se, masp)).toBeLessThan(2.8);
    expect(distanceKm(se, se)).toBe(0);
  });

  it('PRIVACIDADE: a grade arredonda para ~1 km (2 casas) e dá a mesma chave para quem está perto', () => {
    expect(snapToGrid({ lat: -23.55034, lng: -46.63391 })).toEqual({ lat: -23.55, lng: -46.63 });
    expect(gridKey({ lat: -23.5503, lng: -46.6339 })).toBe('-23.55_-46.63');
    expect(gridKey({ lat: -23.5521, lng: -46.6291 })).toBe('-23.55_-46.63'); // vizinho, mesma célula
    expect(gridKey({ lat: -23.5651, lng: -46.6339 })).not.toBe('-23.55_-46.63');
  });

  it('não gera "-0.00" diferente de "0.00"', () => {
    expect(gridKey({ lat: -0.001, lng: 0.001 })).toBe('0.00_0.00');
  });

  it('valida coordenadas', () => {
    expect(isValidLatLng({ lat: -23.5, lng: -46.6 })).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});

describe('horário de funcionamento (opening_hours do OSM)', () => {
  it('24/7 está sempre aberto', () => {
    expect(isOpenAt('24/7', at(SUN, 3))).toBe(true);
    expect(isAlwaysOpen('24/7')).toBe(true);
    expect(isAlwaysOpen('Mo-Su 00:00-24:00')).toBe(true);
    expect(isAlwaysOpen('Mo-Fr 08:00-18:00')).toBe(false);
  });

  it('dias úteis com intervalo de almoço', () => {
    const h = 'Mo-Fr 08:00-12:00,14:00-18:00';
    expect(isOpenAt(h, at(MON, 9))).toBe(true);
    expect(isOpenAt(h, at(MON, 13))).toBe(false);
    expect(isOpenAt(h, at(TUE, 17, 59))).toBe(true);
    expect(isOpenAt(h, at(TUE, 18, 0))).toBe(false); // o fim não está incluído
    expect(isOpenAt(h, at(SAT, 9))).toBe(false); // sábado não está na regra
  });

  it('várias regras; a posterior substitui a anterior nos dias citados; "off"', () => {
    const h = 'Mo-Sa 08:00-18:00; Sa 08:00-12:00; Su off';
    expect(isOpenAt(h, at(SAT, 11))).toBe(true);
    expect(isOpenAt(h, at(SAT, 13))).toBe(false);
    expect(isOpenAt(h, at(SUN, 10))).toBe(false);
    expect(isOpenAt(h, at(MON, 17))).toBe(true);
  });

  it('horário que atravessa a meia-noite vale também na madrugada seguinte', () => {
    const h = 'Fr 18:00-02:00';
    expect(isOpenAt(h, at(5, 23))).toBe(true); // sexta 23h
    expect(isOpenAt(h, at(SAT, 1, 30))).toBe(true); // sábado 01:30
    expect(isOpenAt(h, at(SAT, 2, 30))).toBe(false);
  });

  it('só horários (sem dias) vale todos os dias; dias em lista e intervalo dando a volta (Fr-Mo)', () => {
    expect(isOpenAt('08:00-20:00', at(SUN, 10))).toBe(true);
    expect(isOpenAt('Fr-Mo 10:00-16:00', at(SUN, 11))).toBe(true);
    expect(isOpenAt('Fr-Mo 10:00-16:00', at(TUE, 11))).toBe(false);
    expect(isOpenAt('Mo,We,Fr 09:00-10:00', at(MON, 9, 30))).toBe(true);
  });

  it('regras de feriado (PH) são ignoradas, o resto continua valendo', () => {
    expect(isOpenAt('Mo-Fr 08:00-18:00; PH off', at(MON, 10))).toBe(true);
  });

  it('o que não entende vira "não sei" (null), nunca um palpite', () => {
    for (const raw of ['Jan-Mar Mo-Fr 08:00-12:00', 'sunrise-sunset', 'Mo-Fr 08:00-18:00 "ligue antes"', 'Xx 10:00-12:00', '25:00-26:00', '', undefined, null]) {
      expect(isOpenAt(raw, at(MON, 10))).toBeNull();
    }
    expect(parseOpeningHours('qualquer coisa')).toBeNull();
  });
});

const place = (id: string, over: Partial<Place> = {}): Place => ({
  id: `osm:node/${id}`,
  source: 'osm',
  name: `Local ${id}`,
  category: 'vet',
  lat: -23.55,
  lng: -46.63,
  emergency: false,
  ...over,
});

describe('filtros e ordenação', () => {
  const origin = { lat: -23.55, lng: -46.63 };
  const places = withDistance(
    [
      place('far', { lat: -23.6, name: 'Longe' }),
      place('near', { lat: -23.551, name: 'Perto' }),
      place('shop', { lat: -23.552, category: 'petshop', name: 'Pet shop' }),
      place('er', { lat: -23.58, emergency: true, openingHours: '24/7', name: 'Hospital 24h' }),
      place('closed', { lat: -23.553, openingHours: 'Mo-Fr 08:00-12:00', name: 'Fechada à tarde' }),
    ],
    origin,
  );

  it('ordena pela distância exata calculada no aparelho', () => {
    expect(filterAndSort(places, NO_FILTERS, at(MON, 15)).map((p) => p.name)).toEqual(['Perto', 'Pet shop', 'Fechada à tarde', 'Hospital 24h', 'Longe']);
  });

  it('filtra por tipo', () => {
    expect(filterAndSort(places, { ...NO_FILTERS, categories: ['petshop'] }, at(MON, 15)).map((p) => p.name)).toEqual(['Pet shop']);
  });

  it('emergência/24 h', () => {
    expect(filterAndSort(places, { ...NO_FILTERS, emergencyOnly: true }, at(MON, 15)).map((p) => p.name)).toEqual(['Hospital 24h']);
  });

  it('"aberto agora" só mantém quem sabemos que está aberto', () => {
    expect(filterAndSort(places, { ...NO_FILTERS, openNow: true }, at(MON, 15)).map((p) => p.name)).toEqual(['Hospital 24h']);
    expect(filterAndSort(places, { ...NO_FILTERS, openNow: true }, at(MON, 10)).map((p) => p.name)).toEqual(['Fechada à tarde', 'Hospital 24h']);
  });

  it('modo Resgate: emergência primeiro, depois distância', () => {
    expect(filterAndSort(places, NO_FILTERS, at(MON, 15), { emergencyFirst: true })[0]!.name).toBe('Hospital 24h');
  });
});

describe('schemas de local', () => {
  it('pedido de busca: só raios fixos e coordenadas válidas', () => {
    expect(searchPlacesRequestSchema.safeParse({ lat: -23.55, lng: -46.63, radiusKm: 5 }).success).toBe(true);
    expect(searchPlacesRequestSchema.safeParse({ lat: -23.55, lng: -46.63, radiusKm: 7 }).success).toBe(false);
    expect(searchPlacesRequestSchema.safeParse({ lat: 100, lng: -46.63, radiusKm: 5 }).success).toBe(false);
  });

  it('local válido e inválido; sem nome também vale (muitos locais do OSM não têm)', () => {
    expect(placeSchema.safeParse(place('1')).success).toBe(true);
    const { name: _name, ...unnamed } = place('2');
    expect(placeSchema.safeParse(unnamed).success).toBe(true);
    expect(placeSchema.safeParse({ ...place('1'), category: 'zoo' }).success).toBe(false);
  });

  it('ID do favorito: determinístico e sem "/" (proibido em IDs do Firestore)', () => {
    expect(placeDocKey('osm:way/123')).toBe('osm-way-123');
    expect(favoritePlaceId('u1', 'osm:node/9')).toBe('u1_osm-node-9');
    expect(favoritePlaceId('u1', 'osm:node/9')).toBe(favoritePlaceId('u1', 'osm:node/9'));
  });

  it('sugestão: exige nome e endereço; correção exige o local; telefone com formato', () => {
    const base = { kind: 'new' as const, placeId: '', name: 'Clínica X', category: 'vet' as const, address: 'Rua A, 1', phone: '', is24h: false, note: '' };
    expect(placeSuggestionFormSchema.safeParse(base).success).toBe(true);
    expect(placeSuggestionFormSchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
    expect(placeSuggestionFormSchema.safeParse({ ...base, kind: 'fix' }).success).toBe(false);
    expect(placeSuggestionFormSchema.safeParse({ ...base, phone: 'abc' }).success).toBe(false);
    expect(placeSuggestionFormSchema.safeParse({ ...base, phone: '(11) 3333-4444' }).success).toBe(true);
    expect(suggestionFormToRequest({ ...base, note: '  ' })).toEqual({ kind: 'new', name: 'Clínica X', category: 'vet', address: 'Rua A, 1', is24h: false });
    expect(suggestionFormToRequest({ ...base, kind: 'fix', placeId: 'osm:node/1' }).placeId).toBe('osm:node/1');
  });
});
