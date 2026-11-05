import type { LatLng } from '@petcare/shared';
import { optionalModule } from '@/core/native/optionalModule';

type LocationModule = typeof import('expo-location');

// Carregamento tolerante: um build antigo do app (sem expo-location) continua abrindo; só "usar minha localização" some.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tolerante, de propósito
const Location = optionalModule<LocationModule>(() => require('expo-location'), 'expo-location');

export type LocationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export class LocationError extends Error {
  constructor(public readonly code: 'services-off' | 'timeout' | 'unavailable' | 'not-found') {
    super(code);
    this.name = 'LocationError';
  }
}

export const isLocationAvailable = (): boolean => Location !== null;

function toPermission(res: { granted: boolean; status: string; canAskAgain: boolean }): LocationPermission {
  if (res.granted) return 'granted';
  if (res.status === 'denied' && !res.canAskAgain) return 'denied';
  return 'undetermined';
}

/** Só consulta (não mostra aviso nenhum). Use na Home, que não deve pedir permissão por conta própria. */
export async function getLocationPermission(): Promise<LocationPermission> {
  if (!Location) return 'unavailable';
  return toPermission(await Location.getForegroundPermissionsAsync());
}

/** Pede a permissão "durante o uso do app" (o sistema mostra o aviso). Nunca pedimos localização em segundo plano. */
export async function requestLocationPermission(): Promise<LocationPermission> {
  if (!Location) return 'unavailable';
  return toPermission(await Location.requestForegroundPermissionsAsync());
}

const TIMEOUT_MS = 15_000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

/**
 * Posição atual. Usa a última posição conhecida (até 5 min) para responder rápido; senão pede uma nova,
 * com precisão "equilibrada" (suficiente para achar a clínica mais perto, gasta menos bateria).
 * A posição exata NUNCA sai do aparelho: a busca manda só a célula da grade (~1 km).
 */
export async function getCurrentPosition(): Promise<LatLng> {
  if (!Location) throw new LocationError('unavailable');
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationError('services-off');

  const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null);
  if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new LocationError('timeout')), TIMEOUT_MS);
  });
  try {
    const current = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout]);
    return { lat: current.coords.latitude, lng: current.coords.longitude };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Endereço digitado -> coordenadas, pelo serviço do próprio sistema (grátis, sem chave). */
export async function geocodeAddress(text: string): Promise<LatLng> {
  if (!Location) throw new LocationError('unavailable');
  const results = await Location.geocodeAsync(text.trim());
  const first = results[0];
  if (!first) throw new LocationError('not-found');
  return { lat: first.latitude, lng: first.longitude };
}
