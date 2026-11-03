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
import { deleteHealthEvent } from '@/features/health/health.repo';
import { useHealthEvents } from '@/features/health/hooks';
import { useMemberships } from '@/features/pets/hooks';

export default function HealthEventDetailScreen() {
  const { id, eid } = useLocalSearchParams<{ id: string; eid: string }>();
  const { t, i18n } = useTranslation('health');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const memberships = useMemberships(user.uid);
  const { data, loading } = useHealthEvents(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <LoadingView />;
  const event = data.find((e) => e.id === eid);
  if (!event) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('event.notFound')} body="" />
      </Screen>
    );
  }

  const role = memberships.data.find((m) => m.petId === id)?.role ?? 'viewer';
  const canEdit = role === 'owner' || role === 'caregiver';

  const confirmDelete = () =>
    Alert.alert(t('event.deleteTitle', { name: event.title }), t('event.deleteBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      {
        text: tc('actions.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(undefined);
          try {
            await deleteAllAttachmentFiles(event.attachments);
            await deleteHealthEvent(id, event.id);
            router.back();
          } catch (e) {
            reportError('health.deleteEvent', e);
            setError(t('event.deleteFailed'));
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: event.title }} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={{ gap: 4 }}>
        <AppText variant="display">{event.title}</AppText>
        <AppText color="textMuted">{`${t(`eventType.${event.type}`)} · ${formatIsoDate(event.date, locale)}`}</AppText>
      </View>

      <Card>
        <View style={{ gap: 16 }}>
          {event.description ? <InfoRow label={t('detail.description')} value={event.description} /> : null}
          {event.nextDate ? <InfoRow label={t('detail.nextDate')} value={formatIsoDate(event.nextDate, locale)} /> : null}
          {event.vet?.name || event.vet?.crmvNumber ? (
            <InfoRow
              label={t('detail.vet')}
              value={[event.vet.name, event.vet.crmvNumber ? t('detail.crmv', { number: event.vet.crmvNumber, uf: event.vet.crmvUf ?? '' }) : ''].filter(Boolean).join(' · ')}
            />
          ) : null}
          {event.clinic ? <InfoRow label={t('detail.clinic')} value={event.clinic} /> : null}
        </View>
      </Card>

      <AttachmentsSection target={{ collection: 'health_events', petId: id, recordId: event.id }} attachments={event.attachments ?? []} canEdit={canEdit} />

      {canEdit ? (
        <View style={{ gap: 8 }}>
          <Button icon="create" label={tc('actions.edit')} disabled={busy} onPress={() => router.push({ pathname: '/pet/[id]/health/event/[eid]/edit', params: { id, eid: event.id } })} />
          <Button variant="danger" icon="trash" label={tc('actions.delete')} disabled={busy} onPress={confirmDelete} />
        </View>
      ) : null}
    </Screen>
  );
}
