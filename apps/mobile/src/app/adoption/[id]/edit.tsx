import type { AdoptionListing } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LoadingView } from '@/components/ui/states';
import { reportError } from '@/core/errors/report';
import { AdoptionForm } from '@/features/adoption/AdoptionForm';
import { saveAdoption } from '@/features/adoption/save';
import { getAdoptionContact, subscribeAdoption } from '@/features/centrals/centrals.repo';
import { centralErrorKey } from '@/features/centrals/errors';
import { useLive } from '@/features/centrals/hooks';

export default function EditAdoptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('adoption');
  const { t: tc } = useTranslation('centrals');
  const router = useRouter();
  const listing = useLive<AdoptionListing | null>(id ?? null, null, (ok, ko) => subscribeAdoption(id!, ok, ko), 'adoption.detail');
  const [phone, setPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (id) getAdoptionContact(id).then((p) => setPhone(p ?? '')).catch(() => setPhone(''));
  }, [id]);

  if (listing.loading || !listing.data || phone === null) return <LoadingView />;
  const l = listing.data;

  return (
    <AdoptionForm
      initial={{ ...l, name: l.name ?? '', breed: l.breed ?? '', healthNotes: l.healthNotes ?? '', contactPhone: phone }}
      initialPhotos={l.photoPaths}
      submitLabel={t('form.saveChanges')}
      submitting={saving}
      submitError={error}
      onSubmit={async (values, photos) => {
        setSaving(true);
        setError(undefined);
        try {
          const { photosFailed } = await saveAdoption(values, photos, l.id, l.photoPaths);
          if (photosFailed) Alert.alert(tc('photos.failed'));
          router.back();
        } catch (e) {
          reportError('adoption.update', e);
          setError(tc(centralErrorKey(e)));
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
