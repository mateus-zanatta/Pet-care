import { distanceKm, type LatLng } from './geo';
import { isOpenAt } from './openingHours';
import type { PlaceCategory } from './enums';
import type { Place } from './schemas/place';

export type PlaceWithDistance = Place & { distanceKm: number };

export type PlaceFilters = {
  /** Vazio = todos os tipos. */
  categories: readonly PlaceCategory[];
  emergencyOnly: boolean;
  openNow: boolean;
};

export const NO_FILTERS: PlaceFilters = { categories: [], emergencyOnly: false, openNow: false };

/** Acrescenta a distância EXATA (calculada no aparelho, a partir da posição real). */
export function withDistance(places: readonly Place[], origin: LatLng): PlaceWithDistance[] {
  return places.map((p) => ({ ...p, distanceKm: distanceKm(origin, p) }));
}

/**
 * Filtra e ordena. "Aberto agora" só mantém quem SABEMOS que está aberto (horário entendido e aberto);
 * emergência primeiro serve para o fluxo de Resgate.
 */
export function filterAndSort(
  places: readonly PlaceWithDistance[],
  filters: PlaceFilters,
  now: Date,
  { emergencyFirst = false }: { emergencyFirst?: boolean } = {},
): PlaceWithDistance[] {
  const filtered = places.filter((p) => {
    if (filters.categories.length > 0 && !filters.categories.includes(p.category)) return false;
    if (filters.emergencyOnly && !p.emergency) return false;
    if (filters.openNow && isOpenAt(p.openingHours, now) !== true) return false;
    return true;
  });
  return filtered.sort(
    (a, b) =>
      (emergencyFirst ? Number(b.emergency) - Number(a.emergency) : 0) ||
      a.distanceKm - b.distanceKm ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  );
}
