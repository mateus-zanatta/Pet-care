import { type PetFormValues, petFormToData, petToFormValues } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { Screen } from '@/components/ui/Screen';
import { reportError } from '@/core/errors/report';
import { usePet, usePetPhotoUrl } from '@/features/pets/hooks';
import { PetForm, type PhotoChange } from '@/features/pets/PetForm';
import { removePetPhoto, updatePet, uploadPetPhoto } from '@/features/pets/pets.repo';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('pets');
  const { t: te } = useTranslation('errors');
  const router = useRouter();
  const { data: pet, loading } = usePet(id);
  const photoUrl = usePetPhotoUrl(pet);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  // Só calcula uma vez por pet: o formulário não pode "pular" enquanto a pessoa digita.
  const initialValues = useMemo(() => (pet ? petToFormValues(pet) : null), [pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingView />;
  if (!pet || !initialValues) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('notFound')} body="" />
      </Screen>
    );
  }

  const onSubmit = async (values: PetFormValues, photo: PhotoChange) => {
    setSubmitting(true);
    setError(undefined);
    try {
      await updatePet(pet.id, petFormToData(values));
      try {
        if (photo.kind === 'picked') await uploadPetPhoto(pet.id, photo.photo);
        else if (photo.kind === 'removed') await removePetPhoto(pet.id);
      } catch (e) {
        reportError('pets.photoUpdate', e);
        Alert.alert(te('pets.photoFailed'));
      }
      router.back();
    } catch (e) {
      reportError('pets.update', e);
      setError(te('pets.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PetForm
      initialValues={initialValues}
      currentPhotoUrl={photoUrl}
      submitting={submitting}
      submitError={error}
      onSubmit={onSubmit}
    />
  );
}
