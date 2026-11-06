import type { AdoptionListing } from '@petcare/shared';
import React from 'react';
import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme/ThemeProvider';
import { EnterView, StatusPill } from '@/features/centrals/components';
import { usePhotoUrl } from '@/features/centrals/hooks';

export function AdoptionCard({ listing, index, onPress }: { listing: AdoptionListing; index: number; onPress: () => void }) {
  const { t } = useTranslation('adoption');
  const { t: tp } = useTranslation('pets');
  const { colors, radius } = useTheme();
  const photo = usePhotoUrl(listing.photoPaths[0]);
  const title = listing.name || t(`species.${listing.species}`);
  const subtitle = [t(`age.${listing.ageGroup}`), tp(`sex.${listing.sex}`), `${listing.city}/${listing.uf}`].join(' · ');

  return (
    <EnterView index={index}>
      <Card onPress={onPress} accessibilityLabel={`${title}. ${subtitle}`} testID={`adoption-${listing.id}`}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.accentContainer, alignItems: 'center', justifyContent: 'center' }}>
            {photo ? <Image source={{ uri: photo }} style={{ width: 76, height: 76 }} accessibilityIgnoresInvertColors /> : <Icon name="paw" size={32} color="onAccentContainer" />}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading" numberOfLines={1}>
              {title}
            </AppText>
            <AppText color="textMuted" numberOfLines={2}>
              {subtitle}
            </AppText>
            {listing.status !== 'available' ? <StatusPill label={t(`status.${listing.status}`)} tone={listing.status === 'reserved' ? 'warning' : 'muted'} /> : null}
          </View>
          <Icon name="chevron-forward" color="textMuted" />
        </View>
      </Card>
    </EnterView>
  );
}
