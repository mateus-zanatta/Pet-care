import {
  type LatLng,
  type PlaceWithDistance,
  type SearchPlacesRequest,
  type SearchPlacesResponse,
  type SearchRadiusKm,
  gridKey,
  searchPlacesResponseSchema,
  snapToGrid,
  withDistance,
} from '@petcare/shared';
import { callFunction } from '@/core/firebase/callable';
import { isNetworkError } from '@/core/firebase/callableProtocol';

/** Resultados reaproveitados por 10 minutos (trocar de aba ou voltar à Home não refaz a busca). */
const MEMORY_TTL_MS = 10 * 60_000;
const memory = new Map<string, { at: number; response: SearchPlacesResponse }>();

export function clearPlacesMemory(): void {
  memory.clear();
}

export class PlacesError extends Error {
  /** `original`: o erro de verdade (ex.: código "functions/not-found"), para o relato de erros não perder a pista. */
  constructor(
    public readonly code: 'network' | 'unavailable' | 'unknown',
    public readonly original?: unknown,
  ) {
    super(code);
    this.name = 'PlacesError';
  }
}

/**
 * Busca locais perto de `origin`. PRIVACIDADE: só a célula da grade (~1 km) vai para o servidor;
 * a distância exata de cada local é calculada aqui, com a posição real.
 */
export async function searchNearby(origin: LatLng, radiusKm: SearchRadiusKm, now: number = Date.now()): Promise<PlaceWithDistance[]> {
  const key = `${gridKey(origin)}_${radiusKm}`;
  const hit = memory.get(key);
  let response = hit && now - hit.at <= MEMORY_TTL_MS ? hit.response : null;

  if (!response) {
    const center = snapToGrid(origin);
    try {
      const raw = await callFunction<SearchPlacesRequest, unknown>('searchPlaces', { lat: center.lat, lng: center.lng, radiusKm });
      const parsed = searchPlacesResponseSchema.safeParse(raw);
      if (!parsed.success) throw new PlacesError('unknown', Object.assign(new Error('bad-response'), { code: 'places/bad-response' }));
      response = parsed.data;
    } catch (error) {
      if (error instanceof PlacesError) throw error;
      // "places-unavailable": o OpenStreetMap não respondeu (o servidor está bem). Qualquer outra falha de rede: conexão.
      if ((error as Error)?.message === 'places-unavailable') throw new PlacesError('unavailable');
      if (isNetworkError(error)) throw new PlacesError('network', error);
      throw new PlacesError('unknown', error);
    }
    memory.set(key, { at: now, response });
  }

  return withDistance(response.places, origin);
}
