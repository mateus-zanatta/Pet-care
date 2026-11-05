import { gridKey, type LatLng, type Place, type PlaceSource } from '@petcare/shared';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

/** Validade do cache: estabelecimentos mudam pouco de um dia para o outro. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Se o provedor cair, ainda serve um resultado de até 7 dias (melhor que nada numa emergência). */
export const STALE_MAX_MS = 7 * CACHE_TTL_MS;

export type CacheEntry = { places: Place[]; provider: PlaceSource; fetchedAt: Date };

export interface PlacesCache {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
}

/** Chave: provedor + versão + célula da grade (~1 km) + raio. Ex.: "osm_v1_-23.55_-46.63_5". */
export function cacheKey(provider: PlaceSource, center: LatLng, radiusKm: number): string {
  return `${provider}_v1_${gridKey(center)}_${radiusKm}`;
}

/** Cache em `places_cache/{chave}` (só o servidor lê e escreve: as regras fecham para o app). */
export function firestoreCache(db: Firestore): PlacesCache {
  const col = db.collection('places_cache');
  return {
    async get(key) {
      const snap = await col.doc(key).get();
      if (!snap.exists) return null;
      const data = snap.data() as { places?: Place[]; provider?: PlaceSource; fetchedAt?: Timestamp };
      if (!Array.isArray(data.places) || !data.provider || !data.fetchedAt) return null;
      return { places: data.places, provider: data.provider, fetchedAt: data.fetchedAt.toDate() };
    },
    async set(key, entry) {
      await col.doc(key).set({
        places: entry.places,
        provider: entry.provider,
        fetchedAt: Timestamp.fromDate(entry.fetchedAt),
        // Campo para uma política de TTL do Firestore apagar o que ficou velho (configurar no console).
        expiresAt: Timestamp.fromMillis(entry.fetchedAt.getTime() + STALE_MAX_MS),
      });
    },
  };
}
