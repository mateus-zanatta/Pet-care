import { distanceKm, isAlwaysOpen, type LatLng, MAX_PLACES, type Place, type PlaceCategory } from '@petcare/shared';
import { type PlacesProvider, ProviderError } from './provider';

/**
 * OpenStreetMap via Overpass API (gratuita, mantida por voluntários: usar com moderação, por isso o cache).
 * Marcações buscadas: amenity=veterinary, shop=pet, amenity=animal_shelter.
 */

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const USER_AGENT = 'PetCareApp/1.0 (app de bem-estar animal; busca de veterinarias)';
const TIMEOUT_MS = 25_000;
const RAW_LIMIT = 400;

export function buildOverpassQuery(center: LatLng, radiusKm: number): string {
  const r = Math.round(radiusKm * 1000);
  const at = `(around:${r},${center.lat},${center.lng})`;
  return [
    '[out:json][timeout:25];',
    '(',
    `  nwr["amenity"="veterinary"]${at};`,
    `  nwr["shop"="pet"]${at};`,
    `  nwr["amenity"="animal_shelter"]${at};`,
    ');',
    `out center tags qt ${RAW_LIMIT};`,
  ].join('\n');
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function categoryOf(tags: Record<string, string>): PlaceCategory | null {
  if (tags.amenity === 'veterinary') return 'vet';
  if (tags.amenity === 'animal_shelter') return 'shelter';
  if (tags.shop === 'pet') return 'petshop';
  return null;
}

const EMERGENCY_NAME = /\b24\s?h(oras)?\b|24 horas|emerg[êe]ncia|pronto[- ]?(socorro|atendimento)|plant[ãa]o/i;

function clip(value: string | undefined, max: number): string | undefined {
  const v = value?.trim();
  return v ? v.slice(0, max) : undefined;
}

function addressOf(tags: Record<string, string>): string | undefined {
  if (tags['addr:full']) return clip(tags['addr:full'], 200);
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
  const parts = [street, tags['addr:suburb'], tags['addr:city']].filter(Boolean);
  return parts.length ? clip(parts.join(' - '), 200) : undefined;
}

/** Converte a resposta do Overpass em locais do app: sem duplicados, mais próximos primeiro, no máximo MAX_PLACES. */
export function normalizeOverpass(json: unknown, center: LatLng): Place[] {
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) throw new ProviderError('bad-response', 'sem elements');

  const byId = new Map<string, Place & { d: number }>();
  for (const raw of elements as OverpassElement[]) {
    const tags = raw?.tags;
    if (!tags) continue;
    const category = categoryOf(tags);
    if (!category) continue;
    const lat = raw.lat ?? raw.center?.lat;
    const lng = raw.lon ?? raw.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const name = clip(tags.name ?? tags['name:pt'] ?? tags.brand ?? tags.operator, 120);
    const openingHours = clip(tags.opening_hours, 300);
    const phone = clip((tags.phone ?? tags['contact:phone'])?.split(';')[0], 40);
    const website = clip(tags.website ?? tags['contact:website'], 300);
    const emergency = tags.emergency === 'yes' || isAlwaysOpen(openingHours) || EMERGENCY_NAME.test(name ?? '');

    const id = `osm:${raw.type}/${raw.id}`;
    const place: Place & { d: number } = {
      id,
      source: 'osm',
      category,
      lat,
      lng,
      emergency,
      d: distanceKm(center, { lat, lng }),
      ...(name ? { name } : {}),
      ...(addressOf(tags) ? { address: addressOf(tags) } : {}),
      ...(phone ? { phone } : {}),
      ...(website ? { website } : {}),
      ...(openingHours ? { openingHours } : {}),
    };
    byId.set(id, place);
  }

  return [...byId.values()]
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_PLACES)
    .map(({ d: _d, ...place }) => place);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** Provedor do OpenStreetMap. Tenta o próximo servidor se um estiver sobrecarregado (429/5xx) ou fora do ar. */
export class OverpassProvider implements PlacesProvider {
  readonly id = 'osm' as const;

  constructor(
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly endpoints: readonly string[] = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : OVERPASS_ENDPOINTS,
  ) {}

  async search({ center, radiusKm }: { center: LatLng; radiusKm: number }): Promise<Place[]> {
    const body = `data=${encodeURIComponent(buildOverpassQuery(center, radiusKm))}`;
    let lastError: unknown = null;
    for (const url of this.endpoints) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
          body,
          signal: controller.signal,
        });
        if (!res.ok) {
          lastError = new ProviderError('unavailable', `HTTP ${res.status}`);
          continue; // sobrecarregado ou fora do ar: tenta o próximo
        }
        return normalizeOverpass(await res.json(), center);
      } catch (error) {
        if (error instanceof ProviderError && error.code === 'bad-response') throw error;
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof ProviderError ? lastError : new ProviderError('unavailable', String((lastError as Error)?.message ?? lastError));
  }
}
