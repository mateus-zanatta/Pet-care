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
import { formatIsoDate } from '@/core/dates';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { AttachmentsSection } from '@/features/attachments/AttachmentsSection';
import { deleteAllAttachmentFiles } from '@/features/attachments/attachments.service';
import { deleteVaccine } from '@/features/health/health.repo';
import { useVaccines } from '@/features/health/hooks';
import { useMemberships } from '@/features/pets/hooks';

export default function VaccineDetailScreen() {
  const { id, vid } = useLocalSearchParams<{ id: string; vid: string }>();
  const { t, i18n } = useTranslation('health');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const memberships = useMemberships(user.uid);
  const { data, loading } = useVaccines(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <LoadingView />;
  const vaccine = data.find((v) => v.id === vid);
  if (!vaccine) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('vaccine.notFound')} body="" />
      </Screen>
    );
  }

  const role = memberships.data.find((m) => m.petId === id)?.role ?? 'viewer';
  const canEdit = role === 'owner' || role === 'caregiver';

  const confirmDelete = () =>
    Alert.alert(t('vaccine.deleteTitle', { name: vaccine.name }), t('vaccine.deleteBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      {
        text: tc('actions.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(undefined);
          try {
            await deleteAllAttachmentFiles(vaccine.attachments);
            await deleteVaccine(id, vaccine.id);
            router.back();
          } catch (e) {
            reportError('health.deleteVaccine', e);
            setError(t('vaccine.deleteFailed'));
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: vaccine.name }} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={{ gap: 4 }}>
        <AppText variant="display">{vaccine.name}</AppText>
        <AppText color="textMuted">{t('vaccine.applied', { date: formatIsoDate(vaccine.appliedOn, locale) })}</AppText>
      </View>

      <Card>
        <View style={{ gap: 16 }}>
          {vaccine.nextDoseOn ? <InfoRow label={t('detail.nextDate')} value={formatIsoDate(vaccine.nextDoseOn, locale)} /> : null}
          {vaccine.batch ? <InfoRow label={t('detail.batch')} value={vaccine.batch} /> : null}
          {vaccine.vet?.name || vaccine.vet?.crmvNumber ? (
            <InfoRow
              label={t('detail.vet')}
              value={[vaccine.vet.name, vaccine.vet.crmvNumber ? t('detail.crmv', { number: vaccine.vet.crmvNumber, uf: vaccine.vet.crmvUf ?? '' }) : ''].filter(Boolean).join(' · ')}
            />
          ) : null}
          {vaccine.clinic ? <InfoRow label={t('detail.clinic')} value={vaccine.clinic} /> : null}
          {vaccine.notes ? <InfoRow label={t('detail.notes')} value={vaccine.notes} /> : null}
        </View>
      </Card>

      <AttachmentsSection target={{ collection: 'vaccines', petId: id, recordId: vaccine.id }} attachments={vaccine.attachments ?? []} canEdit={canEdit} />

      {canEdit ? (
        <View style={{ gap: 8 }}>
          <Button icon="create" label={tc('actions.edit')} disabled={busy} onPress={() => router.push({ pathname: '/pet/[id]/health/vaccine/[vid]/edit', params: { id, vid: vaccine.id } })} />
          <Button variant="danger" icon="trash" label={tc('actions.delete')} disabled={busy} onPress={confirmDelete} />
        </View>
      ) : null}
    </Screen>
  );
}
