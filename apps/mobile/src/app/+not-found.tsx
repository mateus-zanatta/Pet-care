import { Link } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';

export default function NotFoundScreen() {
  const { t } = useTranslation('errors');
  const { t: tc } = useTranslation();
  return (
    <Screen>
      <AppText variant="title">{t('generic')}</AppText>
      <Link href="/" accessibilityRole="link">
        <AppText color="primary" variant="heading">
          {tc('actions.back')}
        </AppText>
      </Link>
    </Screen>
  );
}
