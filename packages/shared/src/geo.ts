/** Coordenadas e distâncias. Funções puras, testadas. */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function isValidLatLng(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** Distância em km pela fórmula de haversine (boa até para algumas centenas de km). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Casas decimais da grade: 2 casas ~ 1,1 km. */
export const GRID_DECIMALS = 2;

/**
 * PRIVACIDADE: antes de sair do aparelho, a posição é arredondada para o centro de uma "célula" de ~1 km.
 * O servidor (e o OpenStreetMap) nunca recebem a posição exata; a distância exata é calculada só no celular.
 * A mesma célula também serve de chave do cache: pessoas próximas reaproveitam a mesma busca.
 */
export function snapToGrid(p: LatLng, decimals = GRID_DECIMALS): LatLng {
  const f = 10 ** decimals;
  // +0 normaliza -0 para 0 (evita chaves "−0.00" e "0.00" diferentes para o mesmo lugar).
  return { lat: Math.round(p.lat * f) / f + 0, lng: Math.round(p.lng * f) / f + 0 };
}

/** Chave estável da célula: "-23.55_-46.63". */
export function gridKey(p: LatLng, decimals = GRID_DECIMALS): string {
  const s = snapToGrid(p, decimals);
  return `${s.lat.toFixed(decimals)}_${s.lng.toFixed(decimals)}`;
}
