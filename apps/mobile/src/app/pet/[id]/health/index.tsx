import { buildTimeline, todayIso, upcomingDues } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { useHealthEvents, useVaccines } from '@/features/health/hooks';
import { exportHealthReport } from '@/features/health/report';
import { useMedications } from '@/features/medications/hooks';
import { TimelineRow } from '@/features/health/TimelineRow';
import { useMemberships, usePet } from '@/features/pets/hooks';

export default function HealthTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation('health');
  const { t: tAll } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const memberships = useMemberships(user.uid);
  const vaccines = useVaccines(id);
  const events = useHealthEvents(id);
  const pet = usePet(id);
  const medications = useMedications(id);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();

  const role = memberships.data.find((m) => m.petId === id)?.role ?? 'viewer';
  const canEdit = role === 'owner' || role === 'caregiver';

  const timeline = useMemo(() => buildTimeline(vaccines.data, events.data), [vaccines.data, events.data]);
  const upcoming = useMemo(() => upcomingDues(timeline, todayIso()), [timeline]);

  if (vaccines.loading || events.loading) return <LoadingView />;
  const failed = vaccines.failed || events.failed;

  const exportPdf = async () => {
    if (!pet.data) return;
    setExporting(true);
    setExportError(undefined);
    try {
      const result = await exportHealthReport(
        { pet: pet.data, medications: medications.data, vaccines: vaccines.data, events: events.data, generatedOn: todayIso(), locale },
        (key, options) => String(tAll(key as never, options as never)),
      );
      if (result === 'unavailable') setExportError(t('timeline.exportUnavailable'));
      else track({ name: 'health_report_exported' });
    } catch (e) {
      reportError('health.export', e);
      setExportError(t('timeline.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <Banner tone="info">{t('disclaimer')}</Banner>
      {failed ? <Banner tone="error">{t('timeline.loadFailed')}</Banner> : null}
      {!canEdit ? <Banner tone="info">{t('timeline.viewerOnly')}</Banner> : null}
      {exportError ? <Banner tone="error">{exportError}</Banner> : null}

      <View style={{ gap: 8 }}>
        {canEdit ? (
          <>
            <Button icon="shield-checkmark" label={t('timeline.addVaccine')} onPress={() => router.push({ pathname: '/pet/[id]/health/vaccine/new', params: { id } })} />
            <Button variant="secondary" icon="clipboard" label={t('timeline.addEvent')} onPress={() => router.push({ pathname: '/pet/[id]/health/event/new', params: { id } })} />
          </>
        ) : null}
        <Button variant="secondary" icon="medkit" label={t('timeline.medications')} onPress={() => router.push({ pathname: '/pet/[id]/medications', params: { id } })} />
        <Button
          variant="secondary"
          icon="share"
          label={exporting ? t('timeline.exporting') : t('timeline.export')}
          loading={exporting}
          disabled={!pet.data}
          onPress={() => void exportPdf()}
        />
      </View>

      {timeline.length === 0 && !failed ? (
        <EmptyState icon="heart" title={t('timeline.empty.title')} body={t('timeline.empty.body')} />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <View style={{ gap: 12 }}>
              <AppText variant="title">{t('timeline.upcoming')}</AppText>
              {upcoming.map((item) => (
                <TimelineRow key={`up-${item.kind}-${item.id}`} petId={id} item={item} locale={locale} />
              ))}
            </View>
          ) : null}
          <View style={{ gap: 12 }}>
            <AppText variant="title">{t('timeline.history')}</AppText>
            {timeline.map((item) => (
              <TimelineRow key={`${item.kind}-${item.id}`} petId={id} item={item} locale={locale} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
