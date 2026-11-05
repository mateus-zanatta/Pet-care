import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/states';
import { Screen } from '@/components/ui/Screen';

export default function RescueScreen() {
  const { t } = useTranslation('home');
  const router = useRouter();
  return (
    <Screen>
      <Banner tone="warning">{t('rescue.emergency')}</Banner>
      {/* O passo a passo completo vem na Fase 4; o atendimento mais próximo já funciona. */}
      <Button
        icon="medkit"
        label={t('rescue.findEmergency')}
        onPress={() => router.push({ pathname: '/nearby', params: { mode: 'emergency' } })}
      />
      <EmptyState icon="heart" title={t('rescue.title')} body={t('rescue.soon')} />
    </Screen>
  );
}
