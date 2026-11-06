import { type RescueAlert, isWildRescue } from '@petcare/shared';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { EnterView, StatusPill } from '@/features/centrals/components';

export function RescueAlertCard({ alert, distance, index, onPress }: { alert: RescueAlert; distance?: string; index: number; onPress: () => void }) {
  const { t } = useTranslation('rescue');
  const title = t(`kinds.${alert.animalKind}`) + (alert.count > 1 ? ` (${alert.count})` : '');
  const conditions = alert.conditions.map((c) => t(`conditions.${c}`)).join(', ');
  return (
    <EnterView index={index}>
      <Card onPress={onPress} accessibilityLabel={`${title}. ${conditions}. ${distance ?? ''}`} testID={`rescue-${alert.id}`}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Icon name={isWildRescue(alert.animalKind) ? 'leaf' : 'paw'} size={32} color={alert.conditions.includes('injured') ? 'danger' : 'primary'} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading">{title}</AppText>
            <AppText color="textMuted" numberOfLines={2}>
              {conditions}
              {distance ? ` · ${distance}` : ''}
            </AppText>
            <StatusPill label={t(`status.${alert.status}`)} tone={alert.status === 'open' ? 'danger' : alert.status === 'in_progress' ? 'warning' : 'primary'} />
          </View>
          <Icon name="chevron-forward" color="textMuted" />
        </View>
      </Card>
    </EnterView>
  );
}
