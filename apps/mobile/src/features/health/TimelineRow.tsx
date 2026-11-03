import type { TimelineItem } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatIsoDate } from '@/core/dates';

const EVENT_ICON: Record<string, IconName> = {
  consultation: 'medkit',
  deworming: 'bug',
  flea_tick: 'bug',
  exam: 'flask',
  surgery: 'cut',
  other: 'clipboard',
};

/** Uma linha da linha do tempo de saúde: abre a vacina ou o registro. */
export function TimelineRow({ petId, item, locale }: { petId: string; item: TimelineItem; locale: 'pt-BR' | 'en' }) {
  const { t } = useTranslation('health');
  const router = useRouter();

  const typeLabel = item.kind === 'vaccine' ? t('vaccine.detailTitle') : t(`eventType.${item.type}`);
  const icon: IconName = item.kind === 'vaccine' ? 'shield-checkmark' : (EVENT_ICON[item.type] ?? 'clipboard');
  const date = formatIsoDate(item.date, locale);
  const next = item.nextOn ? t('timeline.next', { date: formatIsoDate(item.nextOn, locale) }) : null;

  const open = () =>
    item.kind === 'vaccine'
      ? router.push({ pathname: '/pet/[id]/health/vaccine/[vid]', params: { id: petId, vid: item.id } })
      : router.push({ pathname: '/pet/[id]/health/event/[eid]', params: { id: petId, eid: item.id } });

  return (
    <Card
      onPress={open}
      accessibilityLabel={[item.title, typeLabel, date, next, item.hasAttachments ? t('timeline.hasAttachments') : null].filter(Boolean).join('. ')}
      testID={`timeline-${item.kind}-${item.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Icon name={icon} color="primary" size={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{item.title}</AppText>
          <AppText color="textMuted">{`${typeLabel} · ${date}`}</AppText>
          {next ? <AppText variant="caption" color="primary">{next}</AppText> : null}
          {item.hasAttachments ? (
            <AppText variant="caption" color="textMuted">
              {t('timeline.hasAttachments')}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevron-forward" color="textMuted" />
      </View>
    </Card>
  );
}
