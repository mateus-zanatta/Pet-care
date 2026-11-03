import { PET_FORM_DEFAULTS, petFormToData } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { Button } from '@/components/ui/Button';
import { useUser } from '@/features/auth/AuthProvider';
import { PetForm, type PhotoChange } from '@/features/pets/PetForm';
import { createPet } from '@/features/pets/pets.repo';
import { uploadPhotoAfterSave } from '@/features/pets/photoUpload';
import type { PetFormValues } from '@petcare/shared';

export default function NewPetScreen() {
  const { t: te } = useTranslation('errors');
  const { t: tr } = useTranslation('rga');
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

      // A foto só sobe se o pet foi confirmado no servidor; se não foi, a pessoa é avisada (nada de falha silenciosa).
      if (photo.kind === 'picked') {
        const outcome = await uploadPhotoAfterSave(petId, photo.photo, status, 'pets.photoUpload');
        if (outcome === 'failed') Alert.alert(te('pets.photoFailed'));
        else if (outcome === 'deferred') Alert.alert(te('pets.photoPending'));
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
      headerSlot={<Button variant="secondary" icon="document-text" label={tr('entry')} onPress={() => router.replace('/pet/import-rga')} />}
    />
  );
}
