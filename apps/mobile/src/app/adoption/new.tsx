import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { AdoptionForm } from '@/features/adoption/AdoptionForm';
import { saveAdoption } from '@/features/adoption/save';
import { centralErrorKey } from '@/features/centrals/errors';

export default function NewAdoptionScreen() {
  const { t } = useTranslation('adoption');
  const { t: tc } = useTranslation('centrals');
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <AdoptionForm
      submitLabel={t('form.publish')}
      submitting={saving}
      submitError={error}
      onSubmit={async (values, photos) => {
        setSaving(true);
        setError(undefined);
        try {
          const { id, photosFailed } = await saveAdoption(values, photos);
          track({ name: 'central_created', central: 'adoption' });
          if (photosFailed) Alert.alert(tc('photos.failed'));
          router.replace({ pathname: '/adoption/[id]', params: { id } });
        } catch (e) {
          reportError('adoption.create', e);
          setError(tc(centralErrorKey(e)));
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
