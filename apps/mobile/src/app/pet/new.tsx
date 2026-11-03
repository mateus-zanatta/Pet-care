import { PET_FORM_DEFAULTS, petFormToData } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { PetForm, type PhotoChange } from '@/features/pets/PetForm';
import { createPet, uploadPetPhoto } from '@/features/pets/pets.repo';
import type { PetFormValues } from '@petcare/shared';

export default function NewPetScreen() {
  const { t: te } = useTranslation('errors');
  const router = useRouter();
  const user = useUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const onSubmit = async (values: PetFormValues, photo: PhotoChange) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const { petId, status } = await createPet({
        uid: user.uid,
        displayName: user.displayName,
        data: petFormToData(values),
      });
      track({ name: 'pet_created', origin: 'manual' });

      // A foto só sobe se o pet foi confirmado no servidor (sem internet, fica para depois).
      if (photo.kind === 'picked' && status === 'committed') {
        try {
          await uploadPetPhoto(petId, photo.photo);
        } catch (e) {
          reportError('pets.photoUpload', e);
          Alert.alert(te('pets.photoFailed'));
        }
      }
      router.replace({ pathname: '/pet/[id]', params: { id: petId } });
    } catch (e) {
      reportError('pets.create', e);
      setError(te('pets.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PetForm
      initialValues={PET_FORM_DEFAULTS}
      currentPhotoUrl={null}
      submitting={submitting}
      submitError={error}
      onSubmit={onSubmit}
    />
  );
}
