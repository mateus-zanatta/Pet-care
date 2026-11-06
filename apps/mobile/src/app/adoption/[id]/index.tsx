import { ADOPTION_STATUS, type AdoptionListing, type AdoptionStatus, type HealthItem } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { InfoRow } from '@/components/ui/InfoRow';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { formatIsoDate } from '@/core/dates';
import { reportError } from '@/core/errors/report';
import { useAuth } from '@/features/auth/AuthProvider';
import { colorLabel, whatsappUrl } from '@/features/adoption/labels';
import { deleteAdoption, getAdoptionContact, subscribeAdoption, updateAdoption } from '@/features/centrals/centrals.repo';
import { AccountRequired, CallButton, EnterView, PhotoGallery, StatusPill } from '@/features/centrals/components';
import { centralErrorKey } from '@/features/centrals/errors';
import { useLive } from '@/features/centrals/hooks';

export default function AdoptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation('adoption');
  const { t: tp } = useTranslation('pets');
  const { t: tc } = useTranslation('centrals');
  const router = useRouter();
  const { user } = useAuth();
  const registered = Boolean(user && !user.isAnonymous);
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const listing = useLive<AdoptionListing | null>(id ?? null, null, (ok, ko) => subscribeAdoption(id!, ok, ko), 'adoption.detail');
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (listing.loading) return <LoadingView />;
  const l = listing.data;
  if (!l) {
    return (
      <Screen>
        <EmptyState icon="heart-dislike" title={t('gone.title')} body={t('gone.body')} actionLabel={t('gone.back')} onAction={() => router.back()} />
      </Screen>
    );
  }
  const isOwner = user?.uid === l.ownerId;

  const revealPhone = async () => {
    try {
      setPhone((await getAdoptionContact(l.id)) ?? '');
    } catch (e) {
      reportError('adoption.contact', e);
      Alert.alert(tc('errors.generic'));
    }
  };

  const changeStatus = async (status: AdoptionStatus) => {
    setBusy(true);
    try {
      await updateAdoption({ id: l.id, status });
    } catch (e) {
      reportError('adoption.status', e);
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
            await deleteAdoption(l.id);
            router.back();
          } catch (e) {
            reportError('adoption.delete', e);
            Alert.alert(tc(centralErrorKey(e)));
          }
        },
      },
    ]);

  const health = (title: string, items: HealthItem[]) =>
    items.length === 0 ? null : (
      <View style={{ gap: 4 }}>
        <AppText variant="label">{title}</AppText>
        {items.map((item, i) => (
          <AppText key={`${item.name}-${i}`}>
            {'• '}
            {[item.name, item.date ? formatIsoDate(item.date, locale) : null, item.note].filter(Boolean).join(' — ')}
          </AppText>
        ))}
      </View>
    );

  const wa = phone ? whatsappUrl(phone) : null;

  return (
    <Screen>
      <EnterView index={0}>
        <PhotoGallery paths={l.photoPaths} />
      </EnterView>
      <EnterView index={1} style={{ gap: 8 }}>
        <AppText variant="display">{l.name || t(`species.${l.species}`)}</AppText>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill label={t(`status.${l.status}`)} tone={l.status === 'available' ? 'accent' : l.status === 'reserved' ? 'warning' : 'muted'} />
          <StatusPill label={`${l.city}/${l.uf}`} tone="primary" />
        </View>
      </EnterView>

      <EnterView index={2}>
        <Card>
          <View style={{ gap: 10 }}>
            <InfoRow label={t('form.species')} value={t(`species.${l.species}`)} />
            <InfoRow label={t('form.sex')} value={tp(`sex.${l.sex}`)} />
            <InfoRow label={t('form.age')} value={t(`age.${l.ageGroup}`)} />
            {l.breed ? <InfoRow label={t('form.breed')} value={l.breed} /> : null}
            <InfoRow label={t('form.colors')} value={l.colors.map((c) => colorLabel(c, t as never, i18n.exists)).join(', ')} />
            {l.size ? <InfoRow label={t('form.size')} value={t(`size.${l.size}`)} /> : null}
            <InfoRow label={t('form.neutered')} value={tp(`tristate.${l.neutered}`)} />
          </View>
        </Card>
      </EnterView>

      <EnterView index={3}>
        <Card tone="alt">
          <View style={{ gap: 12 }}>
            <AppText variant="heading">{t('form.sectionHealth')}</AppText>
            {health(t('form.vaccines'), l.vaccines ?? [])}
            {health(t('form.medications'), l.medications ?? [])}
            {health(t('form.exams'), l.exams ?? [])}
            {l.healthNotes ? <AppText>{l.healthNotes}</AppText> : null}
            {!(l.vaccines?.length || l.medications?.length || l.exams?.length || l.healthNotes) ? <AppText color="textMuted">{t('noHealth')}</AppText> : null}
          </View>
        </Card>
      </EnterView>

      <EnterView index={4} style={{ gap: 8 }}>
        <AppText variant="heading">{t('form.sectionAbout')}</AppText>
        <AppText>{l.description}</AppText>
      </EnterView>

      {!isOwner ? (
        registered ? (
          <EnterView index={5} style={{ gap: 12 }}>
            <Banner tone="info">{t('contactTips')}</Banner>
            {phone === null ? (
              <Button variant="accent" icon="chatbubbles" label={t('showContact')} onPress={() => void revealPhone()} testID="adoption-contact" />
            ) : phone ? (
              <>
                <AppText variant="heading" selectable>
                  {phone}
                </AppText>
                <CallButton label={t('call')} phone={phone} variant="accent" />
                {wa ? <Button variant="secondary" icon="logo-whatsapp" label={t('whatsapp')} onPress={() => void Linking.openURL(wa)} /> : null}
              </>
            ) : (
              <AppText color="textMuted">{t('noContact')}</AppText>
            )}
          </EnterView>
        ) : (
          <AccountRequired body={t('contactAccount')} />
        )
      ) : (
        <EnterView index={5} style={{ gap: 12 }}>
          <AppText variant="heading">{t('owner.title')}</AppText>
          <ChoiceChips
            label={t('owner.status')}
            options={ADOPTION_STATUS.map((value) => ({ value, label: t(`status.${value}`) }))}
            value={l.status}
            onChange={(s) => void changeStatus(s)}
          />
          <Button variant="secondary" icon="create" label={t('owner.edit')} disabled={busy} onPress={() => router.push({ pathname: '/adoption/[id]/edit', params: { id: l.id } })} />
          <Button variant="danger" icon="trash" label={t('owner.delete')} disabled={busy} onPress={remove} />
        </EnterView>
      )}
    </Screen>
  );
}
