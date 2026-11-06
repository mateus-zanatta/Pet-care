import { type LatLng, type RescueAlert, distanceKm } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { useAuth } from '@/features/auth/AuthProvider';
import { subscribeOpenRescueAlerts } from '@/features/centrals/centrals.repo';
import { AccountRequired, EnterView, HubCard } from '@/features/centrals/components';
import { useLive } from '@/features/centrals/hooks';
import { formatDistance } from '@/features/nearby/directions';
import { getCurrentPosition, getLocationPermission } from '@/features/nearby/location';
import { OfficialContacts } from '@/features/rescue/OfficialContacts';
import { RescueAlertCard } from '@/features/rescue/RescueAlertCard';

/** Central de Resgate: socorro rápido, guia passo a passo, alertas de animais precisando de resgate e contatos oficiais. */
export default function RescueScreen() {
  const { t, i18n } = useTranslation('rescue');
  const router = useRouter();
  const { user } = useAuth();
  const registered = Boolean(user && !user.isAnonymous);
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const alerts = useLive<RescueAlert[]>(registered ? 'alerts' : null, [], subscribeOpenRescueAlerts, 'rescue.alerts');
  const [here, setHere] = useState<LatLng | null>(null);

  // Distância só se a pessoa JÁ liberou a localização (esta tela nunca pede permissão sozinha).
  useEffect(() => {
    if (!registered) return;
    getLocationPermission()
      .then((p) => (p === 'granted' ? getCurrentPosition() : null))
      .then((p) => p && setHere(p))
      .catch(() => undefined);
  }, [registered]);

  const sorted = here
    ? [...alerts.data].sort((a, b) => distanceKm(here, a) - distanceKm(here, b))
    : alerts.data;

  return (
    <Screen>
      <EnterView index={0} style={{ gap: 12 }}>
        <Banner tone="warning">{t('emergency')}</Banner>
        <Button
          variant="danger"
          icon="medkit"
          label={t('findEmergency')}
          onPress={() => router.push({ pathname: '/nearby', params: { mode: 'emergency' } })}
          testID="rescue-emergency"
        />
      </EnterView>

      <HubCard index={1} tone="primary" icon="list" title={t('hub.guide.title')} body={t('hub.guide.body')} onPress={() => router.push('/rescue/guide')} testID="rescue-guide" />
      {registered ? (
        <HubCard index={2} tone="accent" icon="megaphone" title={t('hub.report.title')} body={t('hub.report.body')} onPress={() => router.push('/rescue/new')} testID="rescue-new" />
      ) : (
        <AccountRequired body={t('accountBody')} />
      )}

      <EnterView index={3}>
        <OfficialContacts />
      </EnterView>

      {registered ? (
        <View style={{ gap: 12 }}>
          <AppText variant="title">{t('open.title')}</AppText>
          <AppText color="textMuted">{t('open.body')}</AppText>
          {alerts.loading ? <LoadingView /> : null}
          {alerts.error ? <Banner tone="error">{t('open.error')}</Banner> : null}
          {!alerts.loading && !alerts.error && sorted.length === 0 ? <EmptyState icon="happy" title={t('open.emptyTitle')} body={t('open.emptyBody')} /> : null}
          {sorted.map((alert, index) => (
            <RescueAlertCard
              key={alert.id}
              alert={alert}
              index={index}
              distance={here ? formatDistance(distanceKm(here, alert), locale) : undefined}
              onPress={() => router.push({ pathname: '/rescue/[id]', params: { id: alert.id } })}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
