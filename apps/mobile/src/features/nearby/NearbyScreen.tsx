import {
  type FavoritePlace,
  type LatLng,
  PLACE_CATEGORY,
  type Place,
  type PlaceCategory,
  type PlaceWithDistance,
  SEARCH_RADII_KM,
  type SearchRadiusKm,
  filterAndSort,
  withDistance,
} from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { LoadingView } from '@/components/ui/states';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { useNow } from '@/core/time/useNow';
import { useAuth } from '@/features/auth/AuthProvider';
import { addFavorite, removeFavorite } from './favorites.repo';
import { useFavorites } from './hooks';
import {
  LocationError,
  type LocationPermission,
  geocodeAddress,
  getCurrentPosition,
  getLocationPermission,
  requestLocationPermission,
} from './location';
import { NearbyMap, isMapAvailable } from './NearbyMap';
import { PlaceCard } from './PlaceCard';
import { PlacesError, searchNearby } from './places.service';

type Origin = { point: LatLng; source: 'gps' | 'address'; label?: string };
type Phase = 'checking' | 'idle' | 'locating' | 'searching' | 'ready';
type CategoryFilter = 'all' | PlaceCategory;

const WIDEN_BELOW = 5;

/**
 * Perto de mim. Funciona sem cadastro. Ordem: pede a localização (ou aceita um endereço digitado), busca no
 * servidor só pela região aproximada (~1 km) e calcula aqui a distância exata de cada local.
 * `mode="emergency"` (fluxo de Resgate): atendimentos de emergência/24 h primeiro.
 */
export function NearbyScreen({ mode }: { mode?: 'emergency' }) {
  const { t, i18n } = useTranslation('nearby');
  const router = useRouter();
  const { user } = useAuth();
  const now = useNow();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const emergency = mode === 'emergency';
  const registered = Boolean(user && !user.isAnonymous);
  const favorites = useFavorites(user?.uid ?? null, registered);

  const [permission, setPermission] = useState<LocationPermission | null>(null);
  const [phase, setPhase] = useState<Phase>('checking');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radius, setRadius] = useState<SearchRadiusKm>(emergency ? 10 : 5);
  const [results, setResults] = useState<PlaceWithDistance[] | null>(null);
  const [error, setError] = useState<string>();
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');

  const search = useCallback(
    async (next: Origin, nextRadius: SearchRadiusKm) => {
      setOrigin(next);
      setRadius(nextRadius);
      setPhase('searching');
      setError(undefined);
      try {
        setResults(await searchNearby(next.point, nextRadius));
        track({ name: 'nearby_search', source: next.source });
      } catch (e) {
        const code = e instanceof PlacesError ? e.code : 'unknown';
        // Relata o erro ORIGINAL (ex.: "functions/not-found"), não o embrulho "unknown" que não diz nada.
        if (code === 'unknown') reportError('nearby.search', e instanceof PlacesError ? (e.original ?? e) : e);
        setError(t(`errors.${code}`));
      } finally {
        setPhase('ready');
      }
    },
    [t],
  );

  const locate = useCallback(
    async (radiusKm: SearchRadiusKm) => {
      setPhase('locating');
      setError(undefined);
      try {
        await search({ point: await getCurrentPosition(), source: 'gps' }, radiusKm);
      } catch (e) {
        const code = e instanceof LocationError ? e.code : 'unavailable';
        setError(t(code === 'services-off' ? 'permission.servicesOff' : code === 'timeout' ? 'permission.timeout' : 'permission.unavailable'));
        setPhase('idle');
      }
    },
    [search, t],
  );

  // Ao abrir: se a pessoa JÁ liberou a localização, busca direto; se não, mostra a explicação antes de pedir.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await getLocationPermission().catch(() => 'unavailable' as const);
      if (cancelled) return;
      setPermission(current);
      if (current === 'granted') await locate(emergency ? 10 : 5);
      else setPhase('idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [locate, emergency]);

  const askForLocation = async () => {
    const next = permission === 'granted' ? 'granted' : await requestLocationPermission().catch(() => 'unavailable' as const);
    setPermission(next);
    if (next === 'granted') await locate(radius);
    else if (next === 'unavailable') setError(t('permission.unavailable'));
  };

  const searchAddress = async () => {
    if (!address.trim()) return;
    setPhase('locating');
    setError(undefined);
    try {
      const point = await geocodeAddress(address);
      await search({ point, source: 'address', label: address.trim() }, radius);
    } catch (e) {
      setError(t(e instanceof LocationError && e.code !== 'not-found' ? 'permission.unavailable' : 'address.notFound'));
      setPhase('idle');
    }
  };

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.placeId)), [favorites]);

  const shown = useMemo(() => {
    // "Só favoritos" funciona até sem busca: os favoritos guardam a posição do local.
    const base: PlaceWithDistance[] = favoritesOnly
      ? favorites.map((f) => favoriteToPlace(f, origin?.point))
      : (results ?? []);
    return filterAndSort(
      base,
      { categories: category === 'all' ? [] : [category], emergencyOnly, openNow },
      now,
      { emergencyFirst: emergency },
    );
  }, [favoritesOnly, favorites, origin, results, category, emergencyOnly, openNow, now, emergency]);

  const toggleFavorite = async (place: Place) => {
    if (!user || !registered) return Alert.alert(t('favoriteNeedAccount'));
    try {
      const status = favoriteIds.has(place.id)
        ? await removeFavorite(user.uid, place.id)
        : await addFavorite(user.uid, place, t(`category.${place.category}`));
      if (!favoriteIds.has(place.id)) track({ name: 'place_favorite' });
      if (status === 'pending') Alert.alert(t('favoritePending'));
    } catch (e) {
      reportError('nearby.favorite', e);
      Alert.alert(t('favoriteFailed'));
    }
  };

  const openFix = (place: Place) =>
    router.push({
      pathname: '/nearby/suggest',
      params: { kind: 'fix', placeId: place.id, name: place.name ?? '', category: place.category, address: place.address ?? '', phone: place.phone ?? '' },
    });

  const nextRadius = SEARCH_RADII_KM.find((r) => r > radius);
  const categoryOptions = [
    { value: 'all' as const, label: t('filters.all') },
    ...PLACE_CATEGORY.map((value) => ({ value, label: t(`category.${value}`) })),
  ];

  if (phase === 'checking') return <LoadingView />;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={{ gap: 4 }}>
        <AppText variant="display">{t('title')}</AppText>
        <AppText color="textMuted">{t('intro.body')}</AppText>
      </View>
      {emergency ? <Banner tone="warning">{t('emergencyMode')}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      {/* Onde buscar */}
      {origin ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AppText style={{ flex: 1 }} variant="heading">
            {origin.source === 'gps' ? t('from.gps') : t('from.address', { label: origin.label })}
          </AppText>
          <Button variant="ghost" icon="locate" label={t('changeLocation')} onPress={() => setOrigin(null)} />
        </View>
      ) : (
        <View style={{ gap: 12 }} testID="nearby-where">
          {permission === 'denied' ? (
            <>
              <Banner tone="warning">{t('permission.denied')}</Banner>
              <Button variant="secondary" icon="settings" label={t('permission.settings')} onPress={() => void Linking.openSettings()} />
            </>
          ) : permission !== 'unavailable' ? (
            <Button icon="locate" label={t('useLocation')} loading={phase === 'locating'} onPress={() => void askForLocation()} />
          ) : null}
          <TextField
            label={t('address.label')}
            placeholder={t('address.placeholder')}
            value={address}
            onChangeText={setAddress}
            returnKeyType="search"
            onSubmitEditing={() => void searchAddress()}
          />
          <Button variant="secondary" icon="search" label={t('address.search')} disabled={!address.trim()} onPress={() => void searchAddress()} />
          <AppText variant="caption" color="textMuted">
            {t('privacy')}
          </AppText>
        </View>
      )}

      {phase === 'locating' || phase === 'searching' ? (
        <AppText color="textMuted" align="center">
          {phase === 'locating' ? t('locating') : t('searching')}
        </AppText>
      ) : null}

      {/* Filtros e resultados */}
      {results || favoritesOnly ? (
        <>
          <ChoiceChips label={t('filters.type')} options={categoryOptions} value={category} onChange={setCategory} />
          <Checkbox checked={emergencyOnly} onChange={setEmergencyOnly} accessibilityLabel={t('filters.emergency')}>
            <AppText>{t('filters.emergency')}</AppText>
          </Checkbox>
          <Checkbox checked={openNow} onChange={setOpenNow} accessibilityLabel={t('filters.openNow')}>
            <AppText>{t('filters.openNow')}</AppText>
          </Checkbox>
          {registered && favorites.length > 0 ? (
            <Checkbox checked={favoritesOnly} onChange={setFavoritesOnly} accessibilityLabel={t('filters.favorites')}>
              <AppText>{t('filters.favorites')}</AppText>
            </Checkbox>
          ) : null}

          {origin && isMapAvailable() ? (
            <ChoiceChips
              label={t('results.view')}
              options={[
                { value: 'list' as const, label: t('results.list') },
                { value: 'map' as const, label: t('results.map') },
              ]}
              value={view}
              onChange={setView}
            />
          ) : null}

          {!favoritesOnly ? (
            <AppText color="textMuted">{t('results.count', { count: shown.length, radius })}</AppText>
          ) : null}

          {view === 'map' && origin ? (
            <NearbyMap origin={origin.point} radiusKm={radius} places={shown} onSelect={() => setView('list')} />
          ) : null}

          {shown.length === 0 ? <Banner tone="info">{t('results.empty', { radius })}</Banner> : null}

          {view === 'list'
            ? shown.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  now={now}
                  locale={locale}
                  isFavorite={favoriteIds.has(place.id)}
                  onToggleFavorite={registered ? () => void toggleFavorite(place) : undefined}
                  onFix={registered ? () => openFix(place) : undefined}
                />
              ))
            : null}

          {!favoritesOnly && origin && nextRadius && shown.length < WIDEN_BELOW ? (
            <Button variant="secondary" icon="expand" label={t('results.widen', { radius: nextRadius })} onPress={() => void search(origin, nextRadius)} />
          ) : null}
          {!favoritesOnly && origin && error ? (
            <Button variant="secondary" icon="refresh" label={t('retry')} onPress={() => void search(origin, radius)} />
          ) : null}
        </>
      ) : null}

      {registered ? (
        <Button variant="ghost" icon="add-circle" label={t('suggest.cta')} onPress={() => router.push({ pathname: '/nearby/suggest', params: { kind: 'new' } })} />
      ) : null}
      <AppText variant="caption" color="textMuted">
        {t('attribution')}
      </AppText>
    </Screen>
  );
}

/** Favorito -> local (para listar e filtrar junto). Distância só se soubermos onde a pessoa está. */
function favoriteToPlace(f: FavoritePlace, origin: LatLng | undefined): PlaceWithDistance {
  const place: Place = {
    id: f.placeId,
    source: f.source,
    name: f.name,
    category: f.category,
    lat: f.lat,
    lng: f.lng,
    emergency: f.emergency,
    ...(f.address ? { address: f.address } : {}),
    ...(f.phone ? { phone: f.phone } : {}),
    ...(f.openingHours ? { openingHours: f.openingHours } : {}),
  };
  return origin ? withDistance([place], origin)[0]! : { ...place, distanceKm: Number.POSITIVE_INFINITY };
}
