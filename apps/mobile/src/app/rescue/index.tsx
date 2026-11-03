import React from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/states';
import { Screen } from '@/components/ui/Screen';

export default function RescueScreen() {
  const { t } = useTranslation('home');
  return (
    <Screen>
      <Banner tone="warning">{t('rescue.emergency')}</Banner>
      <EmptyState icon="heart" title={t('rescue.title')} body={t('rescue.soon')} />
    </Screen>
  );
}
