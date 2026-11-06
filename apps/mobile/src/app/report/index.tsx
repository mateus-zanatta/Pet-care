import type { AnimalReport } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { LoadingView } from '@/components/ui/states';
import { formatIsoDate } from '@/core/dates';
import { useAuth } from '@/features/auth/AuthProvider';
import { subscribeMyReports } from '@/features/centrals/centrals.repo';
import { AccountRequired, CallButton, EnterView, HubCard, StatusPill } from '@/features/centrals/components';
import { useLive } from '@/features/centrals/hooks';
import { OFFICIAL_NUMBERS } from '@/features/rescue/OfficialContacts';

/** Central de Denúncias: canais oficiais (sempre visíveis) + denúncia pelo app (com conta) + minhas denúncias. */
export default function ReportScreen() {
  const { t, i18n } = useTranslation('report');
  const router = useRouter();
  const { user } = useAuth();
  const registered = Boolean(user && !user.isAnonymous);
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const mine = useLive<AnimalReport[]>(registered ? `reports-${user?.uid}` : null, [], (ok, ko) => subscribeMyReports(user!.uid, ok, ko), 'report.mine');

  return (
    <Screen>
      <EnterView index={0} style={{ gap: 8 }}>
        <AppText variant="display">{t('title')}</AppText>
        <AppText color="textMuted">{t('intro')}</AppText>
      </EnterView>

      <EnterView index={1} style={{ gap: 12 }}>
        <Banner tone="error">{t('flagrant')}</Banner>
        <CallButton label={t('channels.police')} phone={OFFICIAL_NUMBERS.police} variant="danger" />
      </EnterView>

      {registered ? (
        <HubCard index={2} tone="accent" icon="shield-checkmark" title={t('hub.title')} body={t('hub.body')} onPress={() => router.push('/report/new')} testID="report-new" />
      ) : (
        <AccountRequired body={t('accountBody')} />
      )}

      <EnterView index={3}>
        <Card tone="alt">
          <View style={{ gap: 10 }}>
            <AppText variant="heading">{t('channels.title')}</AppText>
            <AppText color="textMuted">{t('channels.intro')}</AppText>
            <CallButton label={t('channels.disque')} phone={OFFICIAL_NUMBERS.disqueDenuncia} />
            <CallButton label={t('channels.ibama')} phone={OFFICIAL_NUMBERS.ibama} />
            <AppText variant="caption" color="textMuted">
              {t('channels.online')}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {t('channels.law')}
            </AppText>
          </View>
        </Card>
      </EnterView>

      {registered ? (
        <View style={{ gap: 12 }}>
          <AppText variant="title">{t('mine.title')}</AppText>
          {mine.loading ? <LoadingView /> : null}
          {mine.error ? <Banner tone="error">{t('mine.error')}</Banner> : null}
          {!mine.loading && !mine.error && mine.data.length === 0 ? <AppText color="textMuted">{t('mine.empty')}</AppText> : null}
          {mine.data.map((r, index) => (
            <EnterView key={r.id} index={index}>
              <Card onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })} accessibilityLabel={`${t(`types.${r.type}`)}. ${t(`status.${r.status}`)}`}>
                <View style={{ gap: 6 }}>
                  <AppText variant="heading">{t(`types.${r.type}`)}</AppText>
                  <AppText color="textMuted">{formatIsoDate(new Date(r.createdAtMs).toISOString().slice(0, 10), locale)}</AppText>
                  <StatusPill label={t(`status.${r.status}`)} tone={r.status === 'received' ? 'warning' : r.status === 'forwarded' ? 'primary' : 'muted'} />
                </View>
              </Card>
            </EnterView>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
