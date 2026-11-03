import { buildSinpatinhasValidationUrl, isRgaFormatValid } from '@petcare/shared';
import * as WebBrowser from 'expo-web-browser';
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
import { reportError } from '@/core/errors/report';
import { isNetworkError } from '@/core/firebase/callableProtocol';
import { useUser } from '@/features/auth/AuthProvider';
import { formatAge, petSummary } from '@/features/pets/format';
import { useMemberships, usePet, usePetPhotoUrl } from '@/features/pets/hooks';
import { PetPhoto } from '@/features/pets/PetPhoto';
import { deletePet } from '@/features/pets/pets.repo';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('pets');
  const { t: tc } = useTranslation();
  const { t: te } = useTranslation('errors');
  const { t: tr } = useTranslation('rga');
  const router = useRouter();
  const user = useUser();
  const { data: pet, loading } = usePet(id);
  const memberships = useMemberships(user.uid);
  const photoUrl = usePetPhotoUrl(pet);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <LoadingView />;
  if (!pet) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('notFound')} body="" />
      </Screen>
    );
  }

  const role = memberships.data.find((m) => m.petId === pet.id)?.role ?? 'viewer';
  const canEdit = role === 'owner' || role === 'caregiver';
  const age = formatAge(pet, t);

  const confirmDelete = () =>
    Alert.alert(t('detail.deleteTitle', { name: pet.name }), t('detail.deleteBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      {
        text: tc('actions.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          setError(undefined);
          try {
            await deletePet(pet.id);
            track({ name: 'pet_deleted' });
            router.back();
          } catch (e) {
            reportError('pets.delete', e);
            // O servidor só aceita o dono do pet. Se recusar, o app costuma estar mostrando um pet que o
            // servidor não conhece (ex.: dados antigos de antes de reiniciar os emuladores).
            const denied = (e as { code?: string }).code === 'functions/permission-denied';
            setError(te(denied ? 'pets.deleteNotOwner' : isNetworkError(e) ? 'network' : 'pets.deleteFailed'));
            setDeleting(false);
          }
        },
      },
    ]);

  const naturalidade = [pet.naturalidade?.cidade, pet.naturalidade?.uf].filter(Boolean).join(' - ');

  return (
    <Screen>
      <Stack.Screen options={{ title: pet.name }} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <PetPhoto url={photoUrl} size={128} />
        <AppText variant="display" align="center">
          {pet.name}
        </AppText>
        <AppText color="textMuted" align="center">
          {petSummary(pet, t)}
        </AppText>
      </View>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Card>
        <View style={{ gap: 16 }}>
          {age ? <InfoRow label={t('detail.age')} value={age} /> : null}
          {pet.breed ? <InfoRow label={t('form.breed')} value={pet.breed} /> : null}
          <InfoRow label={t('detail.neutered')} value={t(`tristate.${pet.neutered}`)} />
          {pet.weightKg !== undefined ? <InfoRow label={t('detail.weight')} value={`${String(pet.weightKg).replace('.', ',')} kg`} /> : null}
          {pet.cor ? <InfoRow label={t('detail.cor')} value={pet.cor} /> : null}
          {naturalidade ? <InfoRow label={t('detail.naturalidade')} value={naturalidade} /> : null}
        </View>
      </Card>

      {pet.microchip || pet.rga ? (
        <Card>
          <View style={{ gap: 16 }}>
            {pet.microchip ? <InfoRow label={t('detail.microchip')} value={pet.microchip} /> : null}
            {pet.rga ? <InfoRow label={t('detail.rga')} value={pet.rga} /> : null}
            {pet.rga && !isRgaFormatValid(pet.rga) ? <Banner tone="warning">{t('form.rgaFormatWarning')}</Banner> : null}
            {pet.sinpatinhas?.qrConfere === false ? <Banner tone="error">{tr('qrMismatchSaved')}</Banner> : null}
            {pet.rga ? (
              <Button
                variant="secondary"
                icon="shield-checkmark"
                label={tr('validate')}
                accessibilityHint={tr('validateHint')}
                onPress={() => void WebBrowser.openBrowserAsync(buildSinpatinhasValidationUrl(pet.rga as string))}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {pet.allergies || pet.notes || pet.address ? (
        <Card>
          <View style={{ gap: 16 }}>
            {pet.allergies ? <InfoRow label={t('detail.allergies')} value={pet.allergies} /> : null}
            {pet.notes ? <InfoRow label={t('detail.notes')} value={pet.notes} /> : null}
            {pet.address ? <InfoRow label={t('detail.address')} value={pet.address.text} /> : null}
          </View>
        </Card>
      ) : null}

      <View style={{ gap: 8 }}>
        {canEdit ? (
          <Button
            label={tc('actions.edit')}
            icon="create"
            onPress={() => router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } })}
            disabled={deleting}
          />
        ) : null}
        {canEdit ? (
          <Button
            variant="secondary"
            icon="document-text"
            label={tr('entry')}
            onPress={() => router.push({ pathname: '/pet/[id]/import-rga', params: { id: pet.id } })}
            disabled={deleting}
          />
        ) : null}
        {role === 'owner' ? (
          <Button variant="danger" icon="trash" label={tc('actions.delete')} onPress={confirmDelete} loading={deleting} />
        ) : null}
      </View>
    </Screen>
  );
}
