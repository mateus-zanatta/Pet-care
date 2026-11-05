import { type Place, isOpenAt } from '@petcare/shared';
import React from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { track } from '@/core/analytics';
import { directionsLinks, formatDistance, phoneUrl } from './directions';

type Props = {
  place: Place & { distanceKm?: number };
  now: Date;
  locale: 'pt-BR' | 'en';
  /** Favoritar/corrigir só para quem tem conta. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onFix?: () => void;
  /** Versão curta (card da Home): sem horário detalhado, favorito e correção. */
  compact?: boolean;
};

/** Cartão do local: nome, tipo, distância, horário, endereço, telefone e os botões Ligar / Como chegar. */
export function PlaceCard({ place, now, locale, isFavorite, onToggleFavorite, onFix, compact }: Props) {
  const { t } = useTranslation('nearby');
  const { t: tc } = useTranslation();
  const name = place.name ?? t(`category.${place.category}`);
  const open = isOpenAt(place.openingHours, now);
  const tel = phoneUrl(place.phone);
  const distance =
    place.distanceKm !== undefined && Number.isFinite(place.distanceKm)
      ? t('card.distance', { distance: formatDistance(place.distanceKm, locale) })
      : null;

  const call = () => {
    if (!tel) return;
    track({ name: 'place_call' });
    Linking.openURL(tel).catch(() => Alert.alert(t('callFailed')));
  };

  const directions = () => {
    const links = directionsLinks(place, Platform.OS);
    Alert.alert(t('directions.title'), name, [
      ...links.map((link) => ({
        text: t(`directions.${link.app}`),
        onPress: () => {
          track({ name: 'place_directions', app: link.app });
          Linking.openURL(link.url).catch(() => Alert.alert(t('directions.failed')));
        },
      })),
      { text: tc('actions.cancel'), style: 'cancel' as const },
    ]);
  };

  const statusText = open === true ? t('card.open') : open === false ? t('card.closed') : t('card.hoursUnknown');

  return (
    <Card testID={`place-${place.id}`}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Icon name={place.category === 'vet' ? 'medkit' : place.category === 'shelter' ? 'home' : 'basket'} color="primary" size={28} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">{name}</AppText>
            <AppText color="textMuted">{[t(`category.${place.category}`), distance].filter(Boolean).join(' · ')}</AppText>
            {place.emergency ? (
              <AppText variant="caption" color="danger">
                {t('card.emergency')}
              </AppText>
            ) : null}
            <AppText variant="caption" color={open === true ? 'primary' : 'textMuted'}>
              {statusText}
            </AppText>
          </View>
        </View>

        {!compact && place.openingHours ? (
          <AppText variant="caption" color="textMuted">
            {t('card.hours', { hours: place.openingHours })}
          </AppText>
        ) : null}
        {place.address ? <AppText>{place.address}</AppText> : null}
        {place.phone ? <AppText color="textMuted">{place.phone}</AppText> : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {tel ? (
            <View style={{ flex: 1 }}>
              <Button icon="call" label={t('card.call')} onPress={call} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button variant={tel ? 'secondary' : 'primary'} icon="navigate" label={t('card.directions')} onPress={directions} />
          </View>
        </View>

        {!compact && (onToggleFavorite || onFix) ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {onToggleFavorite ? (
              <View style={{ flex: 1 }}>
                <Button
                  variant="ghost"
                  icon={isFavorite ? 'star' : 'star-outline'}
                  label={isFavorite ? t('card.unfavorite', { name }) : t('card.favorite', { name })}
                  onPress={onToggleFavorite}
                />
              </View>
            ) : null}
            {onFix ? (
              <View style={{ flex: 1 }}>
                <Button variant="ghost" icon="create" label={t('card.fix')} onPress={onFix} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
