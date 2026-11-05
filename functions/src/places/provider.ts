import type { LatLng, Place, PlaceSource } from '@petcare/shared';

/**
 * Fonte de locais. Hoje: OpenStreetMap via Overpass (grátis). Para trocar por Google Places (cobrado por uso),
 * basta implementar esta interface em outro arquivo e escolher com PLACES_PROVIDER=google (veja googleProvider.ts).
 */
export interface PlacesProvider {
  readonly id: PlaceSource;
  /** `center` já vem arredondado na grade (~1 km): o provedor nunca recebe a posição exata da pessoa. */
  search(query: { center: LatLng; radiusKm: number }): Promise<Place[]>;
}

/** Falha do provedor que o app sabe explicar ("serviço indisponível, tente de novo"). */
export class ProviderError extends Error {
  constructor(
    public readonly code: 'unavailable' | 'bad-response' | 'not-configured',
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ProviderError';
  }
}
