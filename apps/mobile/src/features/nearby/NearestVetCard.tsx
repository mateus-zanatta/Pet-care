import { type PlaceWithDistance } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useNow } from '@/core/time/useNow';
import { getCurrentPosition, getLocationPermission } from './location';
import { PlaceCard } from './PlaceCard';
import { searchNearby } from './places.service';

type State = { kind: 'loading' } | { kind: 'cta' } | { kind: 'none' } | { kind: 'found'; place: PlaceWithDistance };

/**
 * Card "Veterinária mais próxima" da Home. NÃO pede permissão por conta própria (seria um susto ao abrir o app):
 * só usa a localização se a pessoa já liberou na aba Perto de mim. Qualquer falha vira o convite para a aba.
 */
export function NearestVetCard() {
  const { t, i18n } = useTranslation('nearby');
  const { t: th } = useTranslation('home');
  const router = useRouter();
  const now = useNow();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ((await getLocationPermission()) !== 'granted') throw new Error('no-permission');
        const origin = await getCurrentPosition();
        const places = await searchNearby(origin, 10);
        const vets = places.filter((p) => p.category === 'vet').sort((a, b) => a.distanceKm - b.distanceKm);
        if (!cancelled) setState(vets[0] ? { kind: 'found', place: vets[0] } : { kind: 'none' });
      } catch {
        if (!cancelled) setState({ kind: 'cta' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={{ gap: 8 }} testID="nearest-vet">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="medkit" color="primary" />
        <AppText variant="heading">{th('nearest.title')}</AppText>
      </View>
      {state.kind === 'found' ? (
        <PlaceCard place={state.place} now={now} locale={locale} compact />
      ) : (
        <Card tone="alt">
          <View style={{ gap: 8 }}>
            <AppText color="textMuted">
              {state.kind === 'loading' ? t('home.loading') : state.kind === 'none' ? t('home.none') : t('home.hint')}
            </AppText>
            {state.kind !== 'loading' ? (
              <Button variant="secondary" icon="location" label={t('home.cta')} onPress={() => router.push('/nearby')} />
            ) : null}
          </View>
        </Card>
      )}
    </View>
  );
}
