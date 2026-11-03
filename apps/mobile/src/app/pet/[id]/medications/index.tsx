import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { useNow } from '@/core/time/useNow';
import { useUser } from '@/features/auth/AuthProvider';
import { useMedications } from '@/features/medications/hooks';
import { sortMedications } from '@/features/medications/medications.mapper';
import { MedicationListItem } from '@/features/medications/MedicationListItem';
import { useMemberships } from '@/features/pets/hooks';
import { useReminderPermission } from '@/features/reminders/usePermission';

export default function MedicationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('meds');
  const router = useRouter();
  const user = useUser();
  const now = useNow();
  const memberships = useMemberships(user.uid);
  const { data, loading, failed } = useMedications(id);
  const permission = useReminderPermission();

  const role = memberships.data.find((m) => m.petId === id)?.role ?? 'viewer';
  const canEdit = role === 'owner' || role === 'caregiver';
  const add = () => router.push({ pathname: '/pet/[id]/medications/new', params: { id } });

  if (loading) return <LoadingView />;

  const sorted = sortMedications(data);
  const groups = (['active', 'suspended', 'completed'] as const)
    .map((status) => ({ status, items: sorted.filter((m) => m.status === status) }))
    .filter((group) => group.items.length > 0);

  return (
    <Screen>
      <Banner tone="info">{t('disclaimer')}</Banner>
      {failed ? <Banner tone="error">{t('list.loadFailed')}</Banner> : null}
      {!canEdit ? <Banner tone="info">{t('list.viewerOnly')}</Banner> : null}

      {canEdit && permission.state === 'unavailable' ? <Banner tone="warning">{t('list.permission.unavailable')}</Banner> : null}
      {canEdit && data.length > 0 && permission.state && permission.state !== 'granted' && permission.state !== 'unavailable' ? (
        <View style={{ gap: 8 }}>
          <Banner tone="warning">{`${t('list.permission.title')}. ${t('list.permission.body')}`}</Banner>
          {permission.state === 'undetermined' ? (
            <Button variant="secondary" icon="notifications" label={t('list.permission.ask')} onPress={() => void permission.request()} />
          ) : (
            <Button variant="secondary" icon="settings" label={t('list.permission.settings')} onPress={() => void Linking.openSettings()} />
          )}
        </View>
      ) : null}

      {data.length === 0 && !failed ? (
        <EmptyState
          icon="medkit"
          title={t('list.empty.title')}
          body={t('list.empty.body')}
          actionLabel={canEdit ? t('list.add') : undefined}
          onAction={canEdit ? add : undefined}
        />
      ) : (
        <>
          {groups.map((group) => (
            <View key={group.status} style={{ gap: 12 }}>
              <AppText variant="title">{t(`list.sections.${group.status}`)}</AppText>
              {group.items.map((med) => (
                <MedicationListItem key={med.id} petId={id} med={med} now={now} />
              ))}
            </View>
          ))}
          {canEdit ? <Button icon="add" label={t('list.add')} onPress={add} /> : null}
        </>
      )}
    </Screen>
  );
}
