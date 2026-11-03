import React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/states';
import { Screen } from '@/components/ui/Screen';

export default function NearbyScreen() {
  const { t } = useTranslation('home');
  return (
    <Screen edges={['top', 'left', 'right']}>
      <EmptyState icon="location" title={t('nearby.title')} body={t('nearby.soon')} />
    </Screen>
  );
}
