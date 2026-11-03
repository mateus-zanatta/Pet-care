import React from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/states';
import { Screen } from '@/components/ui/Screen';

export default function ReportScreen() {
  const { t } = useTranslation('home');
  return (
    <Screen>
      <Banner tone="warning">{t('report.notOfficial')}</Banner>
      <EmptyState icon="shield-checkmark" title={t('report.title')} body={t('report.soon')} />
    </Screen>
  );
}
