import { RESCUE_ALERT_STATUS, type RescueAlert, type RescueAlertStatus } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { InfoRow } from '@/components/ui/InfoRow';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { reportError } from '@/core/errors/report';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteRescueAlert, subscribeRescueAlert, updateRescueAlert } from '@/features/centrals/centrals.repo';
import { CallButton, EnterView, PhotoGallery, StatusPill } from '@/features/centrals/components';
import { centralErrorKey } from '@/features/centrals/errors';
import { useLive } from '@/features/centrals/hooks';
import { directionsLinks } from '@/features/nearby/directions';
import { OfficialContacts } from '@/features/rescue/OfficialContacts';

export default function RescueAlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('rescue');
  const { t: tc } = useTranslation('centrals');
  const { t: tn } = useTranslation('nearby');
  const router = useRouter();
  const { user } = useAuth();
  const alert = useLive<RescueAlert | null>(id ?? null, null, (ok, ko) => subscribeRescueAlert(id!, ok, ko), 'rescue.detail');
  const [busy, setBusy] = useState(false);

  if (alert.loading) return <LoadingView />;
  const a = alert.data;
  if (!a) {
    return (
      <Screen>
        <EmptyState icon="checkmark-circle" title={t('gone.title')} body={t('gone.body')} actionLabel={t('gone.back')} onAction={() => router.back()} />
      </Screen>
    );
  }
  const isReporter = user?.uid === a.reporterId;

  const changeStatus = async (status: RescueAlertStatus) => {
    setBusy(true);
    try {
      await updateRescueAlert({ id: a.id, status });
    } catch (e) {
      reportError('rescue.status', e);
      Alert.alert(tc(centralErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(t('delete.title'), t('delete.body'), [
      { text: t('delete.cancel'), style: 'cancel' },
      {
        text: t('delete.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRescueAlert(a.id);
            router.back();
          } catch (e) {
            reportError('rescue.delete', e);
            Alert.alert(tc(centralErrorKey(e)));
          }
        },
      },
    ]);

  return (
    <Screen>
      <EnterView index={0} style={{ gap: 8 }}>
        <AppText variant="display">{t(`kinds.${a.animalKind}`) + (a.count > 1 ? ` (${a.count})` : '')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <StatusPill label={t(`status.${a.status}`)} tone={a.status === 'open' ? 'danger' : a.status === 'in_progress' ? 'warning' : 'primary'} />
          {a.conditions.map((c) => (
            <StatusPill key={c} label={t(`conditions.${c}`)} tone="muted" />
          ))}
        </View>
      </EnterView>

      <EnterView index={1}>
        <PhotoGallery paths={a.photoPaths} />
      </EnterView>

      <EnterView index={2}>
        <Card>
          <View style={{ gap: 10 }}>
            <AppText>{a.description}</AppText>
            {a.address ? <InfoRow label={t('form.address')} value={a.address} /> : null}
            {a.reference ? <InfoRow label={t('form.reference')} value={a.reference} /> : null}
          </View>
        </Card>
      </EnterView>

      <EnterView index={3} style={{ gap: 12 }}>
        <AppText variant="heading">{t('detail.goThere')}</AppText>
        {directionsLinks(a, Platform.OS).map((link) => (
          <Button key={link.app} variant="secondary" icon="navigate" label={tn(`directions.${link.app}`)} onPress={() => void Linking.openURL(link.url)} />
        ))}
        {a.contactPhone ? <CallButton label={t('detail.callReporter')} phone={a.contactPhone} variant="primary" /> : null}
      </EnterView>

      <EnterView index={4}>
        <OfficialContacts kind={a.animalKind} />
      </EnterView>

      {isReporter ? (
        <EnterView index={5} style={{ gap: 12 }}>
          <AppText variant="heading">{t('owner.title')}</AppText>
          <ChoiceChips label={t('owner.status')} options={RESCUE_ALERT_STATUS.map((value) => ({ value, label: t(`status.${value}`) }))} value={a.status} onChange={(s) => void changeStatus(s)} />
          <Button variant="danger" icon="trash" label={t('owner.delete')} disabled={busy} onPress={remove} />
        </EnterView>
      ) : null}
    </Screen>
  );
}
