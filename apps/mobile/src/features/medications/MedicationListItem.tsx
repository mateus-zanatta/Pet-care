import { type Medication, expiryStatus, nextDose } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatIsoDate } from '@/core/dates';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { formatWhen, frequencySummary } from './format';

/** Cartão do medicamento na lista: nome, dose "como prescrita", frequência e a próxima dose. */
export function MedicationListItem({ petId, med, now }: { petId: string; med: Medication; now: Date }) {
  const { t, i18n } = useTranslation('meds');
  const router = useRouter();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';

  const next = med.status === 'active' ? nextDose(med, now) : null;
  const expiry = expiryStatus(med.expiresOn);
  const dose = `${med.dose.amount} ${med.dose.unit}`;
  const nextText = med.status === 'active' ? (next ? t('list.next', { when: formatWhen(next, now, locale, t as never) }) : t('list.noNext')) : null;

  return (
    <Card
      onPress={() => router.push({ pathname: '/pet/[id]/medications/[medId]', params: { id: petId, medId: med.id } })}
      accessibilityLabel={[med.name, dose, frequencySummary(med.frequency, t as never), nextText ?? t(`status.${med.status}`)].join('. ')}
      testID={`medication-${med.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Icon name="medkit" color={med.status === 'active' ? 'primary' : 'textMuted'} size={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{med.name}</AppText>
          <AppText>{`${dose} · ${frequencySummary(med.frequency, t as never)}`}</AppText>
          {nextText ? <AppText color="textMuted">{nextText}</AppText> : <AppText color="textMuted">{t(`status.${med.status}`)}</AppText>}
          {expiry ? (
            <AppText variant="caption" color={expiry === 'expired' ? 'danger' : 'textMuted'}>
              {expiry === 'expired' ? t('detail.expired', { date: formatIsoDate(med.expiresOn ?? '', locale) }) : t('detail.expiresSoon', { date: formatIsoDate(med.expiresOn ?? '', locale) })}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevron-forward" color="textMuted" />
      </View>
    </Card>
  );
}
