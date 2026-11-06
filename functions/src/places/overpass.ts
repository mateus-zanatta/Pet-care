import { distanceKm, isAlwaysOpen, type LatLng, MAX_PLACES, type Place, type PlaceCategory } from '@petcare/shared';
import { type PlacesProvider, ProviderError } from './provider';

/**
 * OpenStreetMap via Overpass API (gratuita, mantida por voluntários: usar com moderação, por isso o cache).
 * Marcações buscadas: amenity=veterinary, shop=pet, amenity=animal_shelter.
 */

/** Servidores públicos do Overpass (lista em wiki.openstreetmap.org/wiki/Overpass_API), na ordem de tentativa. */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
/**
 * Identificação do app. Desde abril de 2026 o servidor principal recusa (HTTP 406) pedidos sem User-Agent ou com o
 * padrão de bibliotecas ("node", "python-requests"...), e a política de uso pede um jeito de contatar quem consulta:
 * por isso vai o endereço do projeto. Dá para trocar com a variável OVERPASS_USER_AGENT (ex.: com um e-mail de contato).
 */
export const USER_AGENT = process.env.OVERPASS_USER_AGENT || 'TailwagApp/1.0 (+https://github.com/mateus-zanatta/pet-care)';
/** Por servidor. 3 tentativas x 18 s cabem nos 60 s da função (e a pessoa não espera um minuto inteiro à toa). */
const TIMEOUT_MS = 18_000;
const RAW_LIMIT = 400;

export function buildOverpassQuery(center: LatLng, radiusKm: number): string {
  const r = Math.round(radiusKm * 1000);
  const at = `(around:${r},${center.lat},${center.lng})`;
  return [
    `[out:json][timeout:${TIMEOUT_MS / 1000}];`,
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

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Motivo técnico legível de uma falha de rede. O Node só diz "fetch failed"; o motivo real fica em `cause`
 * (ex.: ENOTFOUND = sem DNS/internet, ECONNRESET = conexão cortada, UNABLE_TO_GET_ISSUER_CERT_LOCALLY = um
 * antivírus inspecionando HTTPS com um certificado que o Node não conhece). Nunca contém coordenadas.
 */
export function describeFetchError(error: unknown): string {
  const e = error as { name?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const message = typeof e?.message === 'string' ? e.message : String(error);
  if (e?.name === 'AbortError' || /aborted/i.test(message)) return `sem resposta em ${TIMEOUT_MS / 1000} s`;
  const cause = typeof e?.cause?.code === 'string' ? e.cause.code : typeof e?.cause?.message === 'string' ? e.cause.message : '';
  return cause ? `${message} (${cause})` : message;
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
    // O motivo de CADA servidor tentado, para o log dizer exatamente o que aconteceu.
    const failures: string[] = [];
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
          failures.push(`${hostOf(url)}: HTTP ${res.status}`);
          continue; // sobrecarregado ou fora do ar: tenta o próximo
        }
        return normalizeOverpass(await res.json(), center);
      } catch (error) {
        if (error instanceof ProviderError && error.code === 'bad-response') throw error;
        failures.push(`${hostOf(url)}: ${describeFetchError(error)}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ProviderError('unavailable', failures.join('; ') || 'nenhum servidor configurado');
  }
}
