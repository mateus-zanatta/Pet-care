import {
  type DoseLog,
  type DoseOutcome,
  type Medication,
  type MedicationStatus,
  dueDoses,
  expiryStatus,
  isTreatmentOver,
  nextDose,
  todayIso,
} from '@petcare/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InfoRow } from '@/components/ui/InfoRow';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { track } from '@/core/analytics';
import { formatIsoDate } from '@/core/dates';
import { reportError } from '@/core/errors/report';
import { useNow } from '@/core/time/useNow';
import { useUser } from '@/features/auth/AuthProvider';
import { formatClock, formatWhen, frequencySummary } from '@/features/medications/format';
import { useDoseLogs, useMedications } from '@/features/medications/hooks';
import { deleteMedication, logDose, setMedicationStatus, undoDose } from '@/features/medications/medications.repo';
import { useMemberships } from '@/features/pets/hooks';

/** Início do histórico mostrado: 14 dias atrás, à 00:00 UTC (valor estável durante o dia). */
function historySince(now: Date): string {
  const d = new Date(now.getTime() - 14 * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export default function MedicationDetailScreen() {
  const { id, medId } = useLocalSearchParams<{ id: string; medId: string }>();
  const { t, i18n } = useTranslation('meds');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const now = useNow();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const memberships = useMemberships(user.uid);
  const meds = useMedications(id);
  const [since] = useState(() => historySince(new Date()));
  const logs = useDoseLogs(id, since);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (meds.loading) return <LoadingView />;
  const med = meds.data.find((m) => m.id === medId);
  if (!med) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('detail.notFound')} body="" />
      </Screen>
    );
  }

  const role = memberships.data.find((m) => m.petId === id)?.role ?? 'viewer';
  const canEdit = role === 'owner' || role === 'caregiver';
  const myLogs = logs.data.filter((l) => l.medicationId === med.id);
  const loggedKeys = new Set(myLogs.map((l) => l.id));
  const due = med.status === 'active' && canEdit ? dueDoses(med.id, med, now, loggedKeys) : [];
  const next = med.status === 'active' ? nextDose(med, now) : null;
  const expiry = expiryStatus(med.expiresOn);
  const today = todayIso(now);

  const run = async (action: () => Promise<unknown>, failureKey: string, scope: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      reportError(scope, e);
      setError(t(failureKey as never));
    } finally {
      setBusy(false);
    }
  };

  const record = (scheduledFor: Date, outcome: DoseOutcome) =>
    run(
      async () => {
        const { status } = await logDose({
          petId: id,
          medicationId: med.id,
          scheduledFor,
          outcome,
          uid: user.uid,
          displayName: user.displayName,
        });
        track({ name: 'dose_logged', outcome });
        if (status === 'pending') Alert.alert(t('detail.logPending'));
      },
      'detail.logFailed',
      'medications.logDose',
    );

  const changeStatus = (status: MedicationStatus) =>
    run(() => setMedicationStatus(id, med.id, status), 'detail.statusFailed', 'medications.status');

  const confirmDelete = () =>
    Alert.alert(t('detail.deleteTitle', { name: med.name }), t('detail.deleteBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      {
        text: tc('actions.delete'),
        style: 'destructive',
        onPress: () =>
          void run(
            async () => {
              await deleteMedication(id, med.id);
              router.back();
            },
            'detail.deleteFailed',
            'medications.delete',
          ),
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: med.name }} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {expiry === 'expired' ? <Banner tone="error">{t('detail.expired', { date: formatIsoDate(med.expiresOn ?? '', locale) })}</Banner> : null}
      {expiry === 'soon' ? <Banner tone="warning">{t('detail.expiresSoon', { date: formatIsoDate(med.expiresOn ?? '', locale) })}</Banner> : null}
      {isTreatmentOver(med, today) ? (
        <Banner tone="warning">{t('detail.treatmentOver', { date: formatIsoDate(med.endDate ?? '', locale) })}</Banner>
      ) : null}

      <View style={{ gap: 4 }}>
        <AppText variant="display">{med.name}</AppText>
        <AppText color="textMuted">{t(`status.${med.status}`)}</AppText>
      </View>

      {due.length > 0 ? (
        <Card tone="primary">
          <View style={{ gap: 16 }}>
            <AppText variant="title">{t('detail.dueTitle')}</AppText>
            {due.map((at) => (
              <View key={at.getTime()} style={{ gap: 8 }} testID={`due-${at.getTime()}`}>
                <AppText variant="heading">
                  {todayIso(at) === today
                    ? t('detail.dueAt', { time: formatClock(at) })
                    : t('detail.dueAtDay', { day: formatIsoDate(todayIso(at), locale), time: formatClock(at) })}
                </AppText>
                <AppText>{`${med.dose.amount} ${med.dose.unit}`}</AppText>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button icon="checkmark" label={t('detail.give')} disabled={busy} onPress={() => void record(at, 'given')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button variant="secondary" icon="play-skip-forward" label={t('detail.skip')} disabled={busy} onPress={() => void record(at, 'skipped')} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: 16 }}>
          <InfoRow label={t('detail.dose')} value={`${med.dose.amount} ${med.dose.unit}`} />
          <InfoRow label={t('detail.route')} value={t(`route.${med.dose.route}`)} />
          <InfoRow label={t('detail.frequency')} value={frequencySummary(med.frequency, t as never)} />
          <InfoRow label={t('detail.period')} value={periodText(med, locale, t as never)} />
          {med.status === 'active' ? (
            <InfoRow label={t('detail.nextDose')} value={next ? formatWhen(next, now, locale, t as never) : t('list.noNext')} />
          ) : null}
          {med.barcode ? <InfoRow label={t('detail.code')} value={med.barcode} /> : null}
          {med.batch ? <InfoRow label={t('detail.batch')} value={med.batch} /> : null}
          {med.expiresOn ? <InfoRow label={t('detail.expiresOn')} value={formatIsoDate(med.expiresOn, locale)} /> : null}
          {med.prescribedOn ? <InfoRow label={t('detail.prescribedOn')} value={formatIsoDate(med.prescribedOn, locale)} /> : null}
          {med.vet?.name || med.vet?.crmvNumber ? (
            <InfoRow
              label={t('detail.vet')}
              value={[med.vet.name, med.vet.crmvNumber ? t('detail.crmv', { number: med.vet.crmvNumber, uf: med.vet.crmvUf ?? '' }) : '']
                .filter(Boolean)
                .join(' · ')}
            />
          ) : null}
          {med.place ? (
            <InfoRow label={t('detail.place')} value={[t(`place.${med.place.kind}`), med.place.text].filter(Boolean).join(': ')} />
          ) : null}
          {med.notes ? <InfoRow label={t('detail.notes')} value={med.notes} /> : null}
        </View>
      </Card>

      <View style={{ gap: 12 }}>
        <AppText variant="title">{t('detail.historyTitle')}</AppText>
        {myLogs.length === 0 ? (
          <AppText color="textMuted">{t('detail.historyEmpty')}</AppText>
        ) : (
          myLogs.map((log) => (
            <HistoryRow key={log.id} log={log} now={now} locale={locale} canEdit={canEdit} busy={busy} onUndo={() => void run(() => undoDose(id, log.id), 'detail.undoFailed', 'medications.undo')} />
          ))
        )}
      </View>

      {canEdit ? (
        <View style={{ gap: 8 }}>
          <Button
            icon="create"
            label={tc('actions.edit')}
            onPress={() => router.push({ pathname: '/pet/[id]/medications/[medId]/edit', params: { id, medId: med.id } })}
            disabled={busy}
          />
          {med.status === 'active' ? (
            <>
              <Button variant="secondary" icon="checkmark-done" label={t('detail.complete')} onPress={() => void changeStatus('completed')} disabled={busy} />
              <Button variant="secondary" icon="pause" label={t('detail.suspend')} onPress={() => void changeStatus('suspended')} disabled={busy} />
            </>
          ) : (
            <Button variant="secondary" icon="play" label={t('detail.reactivate')} onPress={() => void changeStatus('active')} disabled={busy} />
          )}
          <Button variant="danger" icon="trash" label={tc('actions.delete')} onPress={confirmDelete} disabled={busy} />
        </View>
      ) : null}
    </Screen>
  );
}

function periodText(med: Medication, locale: 'pt-BR' | 'en', t: (key: string, options?: Record<string, unknown>) => string): string {
  const start = formatIsoDate(med.startDate, locale);
  return med.endDate
    ? t('detail.periodEnds', { start, end: formatIsoDate(med.endDate, locale) })
    : t('detail.periodContinuous', { start });
}

function HistoryRow({ log, now, locale, canEdit, busy, onUndo }: { log: DoseLog; now: Date; locale: 'pt-BR' | 'en'; canEdit: boolean; busy: boolean; onUndo: () => void }) {
  const { t } = useTranslation('meds');
  const scheduled = new Date(log.scheduledFor);
  const time = formatClock(new Date(log.actualAt));
  const outcome = log.outcome === 'given' ? t('detail.given', { time }) : t('detail.skipped', { time });
  const who = log.byName ? ` · ${t('detail.by', { name: log.byName })}` : '';
  return (
    <Card testID={`log-${log.id}`}>
      <View style={{ gap: 4 }}>
        <AppText variant="heading">{formatWhen(scheduled, now, locale, t as never)}</AppText>
        <AppText>{`${outcome}${who}`}</AppText>
        {canEdit ? <Button variant="secondary" icon="arrow-undo" label={t('detail.undo')} disabled={busy} onPress={onUndo} /> : null}
      </View>
    </Card>
  );
}

