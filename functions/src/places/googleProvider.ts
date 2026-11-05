import type { Place } from '@petcare/shared';
import { type PlacesProvider, ProviderError } from './provider';

/**
 * Ponto de troca para o Google Places (cobrado por uso; precisa de conta de cobrança no Google Cloud).
 * Para ativar: implementar `search` com a "Places API (New) - Nearby Search" (tipos veterinary_care e pet_store),
 * converter cada resultado para `Place` (source 'google') e definir PLACES_PROVIDER=google nas Functions.
 * Até lá, escolher este provedor devolve um erro claro em vez de buscar em lugar nenhum.
 */
export class GooglePlacesProvider implements PlacesProvider {
  readonly id = 'google' as const;

  async search(): Promise<Place[]> {
    throw new ProviderError('not-configured', 'Google Places ainda não foi implementado');
  }
}
