import type { AnimalReport } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { InfoRow } from '@/components/ui/InfoRow';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { formatIsoDate } from '@/core/dates';
import { subscribeReport } from '@/features/centrals/centrals.repo';
import { EnterView, PhotoGallery, StatusPill } from '@/features/centrals/components';
import { useLive } from '@/features/centrals/hooks';
import { SuccessCheck } from '@/features/centrals/SuccessCheck';

export default function ReportDetailScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { t, i18n } = useTranslation('report');
  const { t: tr } = useTranslation('rescue');
  const router = useRouter();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const report = useLive<AnimalReport | null>(id ?? null, null, (ok, ko) => subscribeReport(id!, ok, ko), 'report.detail');

  if (report.loading) return <LoadingView />;
  /** Logo após enviar, a confirmação entra primeiro e o resto vem em seguida (não tudo ao mesmo tempo). */
  const offset = created ? 1 : 0;
  const r = report.data;
  if (!r) {
    return (
      <Screen>
        <EmptyState icon="document" title={t('gone.title')} body={t('gone.body')} actionLabel={t('gone.back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {created ? <SuccessCheck title={t('sent.title')} body={t('sent.body')} /> : null}
      <EnterView index={offset} style={{ gap: 8 }}>
        <AppText variant="title">{t(`types.${r.type}`)}</AppText>
        <StatusPill label={t(`status.${r.status}`)} tone={r.status === 'received' ? 'warning' : r.status === 'forwarded' ? 'primary' : 'muted'} />
        <AppText color="textMuted">{t(`statusHelp.${r.status}`)}</AppText>
      </EnterView>
      <EnterView index={offset + 1}>
        <Card>
          <View style={{ gap: 10 }}>
            <AppText>{r.description}</AppText>
            <InfoRow label={t('detail.sentOn')} value={formatIsoDate(new Date(r.createdAtMs).toISOString().slice(0, 10), locale)} />
            {r.occurredOn ? <InfoRow label={t('form.occurredOn')} value={formatIsoDate(r.occurredOn, locale)} /> : null}
            {r.ongoing ? <InfoRow label={t('detail.ongoing')} value={t('detail.yes')} /> : null}
            {r.animalKind ? <InfoRow label={t('form.animalKind')} value={tr(`kinds.${r.animalKind}`)} /> : null}
            {r.address ? <InfoRow label={t('form.address')} value={r.address} /> : null}
            <InfoRow label={t('detail.identity')} value={r.anonymous ? t('detail.anonymous') : t('detail.identified')} />
          </View>
        </Card>
      </EnterView>
      <EnterView index={offset + 2}>
        <PhotoGallery paths={r.photoPaths} />
      </EnterView>
    </Screen>
  );
}
