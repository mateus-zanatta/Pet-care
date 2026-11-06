import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { type SearchPlacesResponse, searchPlacesRequestSchema, snapToGrid } from '@petcare/shared';
import { db } from '../admin';
import { callableOptions } from '../config';
import { CACHE_TTL_MS, cacheKey, firestoreCache, type PlacesCache, STALE_MAX_MS } from './cache';
import { GooglePlacesProvider } from './googleProvider';
import { OverpassProvider } from './overpass';
import { type PlacesProvider, ProviderError } from './provider';

export function providerFromEnv(name = process.env.PLACES_PROVIDER ?? 'osm'): PlacesProvider {
  return name === 'google' ? new GooglePlacesProvider() : new OverpassProvider();
}

export type SearchDeps = {
  provider: PlacesProvider;
  cache: PlacesCache;
  now: Date;
  /** Para o log do servidor: o motivo técnico da falha do provedor (ex.: "unavailable: HTTP 429"), nunca coordenadas. */
  onProviderError?: (error: unknown) => void;
};

/**
 * Busca locais perto de um ponto. O ponto é arredondado AQUI TAMBÉM (defesa extra: mesmo que um app antigo
 * mande a posição exata, ela nunca é usada nem registrada). Usa o cache; se o provedor falhar, devolve um
 * resultado antigo (até 7 dias) em vez de deixar a pessoa sem nada.
 */
export async function handleSearchPlaces(data: unknown, { provider, cache, now, onProviderError }: SearchDeps): Promise<SearchPlacesResponse> {
  const parsed = searchPlacesRequestSchema.safeParse(data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid-input');

  const center = snapToGrid({ lat: parsed.data.lat, lng: parsed.data.lng });
  const { radiusKm } = parsed.data;
  const key = cacheKey(provider.id, center, radiusKm);

  const cached = await cache.get(key).catch(() => null);
  const age = cached ? now.getTime() - cached.fetchedAt.getTime() : Number.POSITIVE_INFINITY;
  if (cached && age <= CACHE_TTL_MS) return { places: cached.places, provider: cached.provider, cached: true };

  try {
    const places = await provider.search({ center, radiusKm });
    await cache.set(key, { places, provider: provider.id, fetchedAt: now }).catch(() => undefined);
    return { places, provider: provider.id, cached: false };
  } catch (error) {
    onProviderError?.(error);
    if (cached && age <= STALE_MAX_MS) return { places: cached.places, provider: cached.provider, cached: true };
    if (error instanceof ProviderError && error.code === 'not-configured') throw new HttpsError('failed-precondition', 'provider-not-configured');
    throw new HttpsError('unavailable', 'places-unavailable');
  }
}

/**
 * Perto de mim: funciona também SEM cadastro (login anônimo), porque Resgate e Perto de mim são abertos.
 * PRIVACIDADE: o log registra só provedor, se veio do cache e quantos locais; nunca coordenadas.
 */
export const searchPlaces = onCall({ ...callableOptions, memory: '256MiB', timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'auth-required');
  const result = await handleSearchPlaces(request.data, {
    provider: providerFromEnv(),
    cache: firestoreCache(db()),
    now: new Date(),
    onProviderError: (error) => logger.warn('places_provider_failed', { detail: String((error as Error)?.message ?? error).slice(0, 400) }),
  });
  logger.info('places_search', { provider: result.provider, cached: result.cached, count: result.places.length });
  return result;
});
