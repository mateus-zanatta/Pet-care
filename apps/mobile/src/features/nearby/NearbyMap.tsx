import type { LatLng, PlaceWithDistance } from '@petcare/shared';
import Constants from 'expo-constants';
import React from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { optionalModule } from '@/core/native/optionalModule';

type MapsModule = typeof import('react-native-maps');

// Carregamento tolerante: um build antigo (sem react-native-maps) continua abrindo; só o mapa some.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tolerante, de propósito
const maps = optionalModule<MapsModule>(() => require('react-native-maps'), 'react-native-maps');

/**
 * O mapa só aparece quando funciona de verdade:
 * - iPhone: Apple Maps (sem chave);
 * - Android: Google Maps, que EXIGE uma chave no build (GOOGLE_MAPS_ANDROID_API_KEY). Sem ela o mapa não abre,
 *   então a tela fica só em lista (e "Como chegar" abre o app de mapas do celular).
 */
export function isMapAvailable(): boolean {
  if (!maps) return false;
  if (Platform.OS === 'ios') return true;
  if (Platform.OS === 'android') return (Constants.expoConfig?.extra as { googleMapsAndroid?: boolean } | undefined)?.googleMapsAndroid === true;
  return false;
}

type Props = {
  origin: LatLng;
  radiusKm: number;
  places: readonly PlaceWithDistance[];
  onSelect: (place: PlaceWithDistance) => void;
};

export function NearbyMap({ origin, radiusKm, places, onSelect }: Props) {
  const { t } = useTranslation('nearby');
  if (!maps || !isMapAvailable()) return null;
  const MapView = maps.default;
  const { Marker } = maps;
  // 1 grau de latitude ~ 111 km: a janela mostra o raio da busca com uma folga.
  const delta = (radiusKm / 111) * 2.2;

  return (
    <View style={{ height: 360, borderRadius: 16, overflow: 'hidden' }} testID="nearby-map">
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: origin.lat, longitude: origin.lng, latitudeDelta: delta, longitudeDelta: delta }}
        showsUserLocation
        toolbarEnabled={false}
      >
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.name ?? t(`category.${p.category}`)}
            description={p.emergency ? t('card.emergency') : t(`category.${p.category}`)}
            pinColor={p.emergency ? 'red' : undefined}
            onCalloutPress={() => onSelect(p)}
          />
        ))}
      </MapView>
    </View>
  );
}
