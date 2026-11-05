import { medicationFormToData, medicationToFormValues, type MedicationFormValues } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { reportError } from '@/core/errors/report';
import { useMedications } from '@/features/medications/hooks';
import { updateMedication } from '@/features/medications/medications.repo';
import { MedicationForm } from '@/features/medications/MedicationForm';
import { useScannedCode } from '@/features/medications/scanInbox';
import { useFavorites } from '@/features/nearby/hooks';
import { useUser } from '@/features/auth/AuthProvider';

export default function EditMedicationScreen() {
  const { id, medId } = useLocalSearchParams<{ id: string; medId: string }>();
  const { t } = useTranslation('meds');
  const router = useRouter();
  const { data, loading } = useMedications(id);
  const scannedCode = useScannedCode();
  const user = useUser();
  const favorites = useFavorites(user.uid, !user.isAnonymous);
  const favoritePlaces = useMemo(
    // Clínicas primeiro (são o "local" mais comum de um medicamento).
    () => [...favorites].sort((a, b) => Number(b.category === 'vet') - Number(a.category === 'vet') || a.name.localeCompare(b.name)),
    [favorites],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <LoadingView />;
  const med = data.find((m) => m.id === medId);
  if (!med) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('detail.notFound')} body="" />
      </Screen>
    );
  }

  const onSubmit = async (values: MedicationFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const status = await updateMedication(id, med.id, medicationFormToData(values));
      if (status === 'pending') Alert.alert(t('form.savePending'));
      router.back();
    } catch (e) {
      reportError('medications.update', e);
      setError(t('form.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MedicationForm
      key={med.id}
      initialValues={medicationToFormValues(med)}
      submitting={submitting}
      submitError={error}
      showStatus
      scannedCode={scannedCode}
      favoritePlaces={favoritePlaces}
      onScan={() => router.push({ pathname: '/pet/[id]/medications/scan', params: { id } })}
      onSubmit={onSubmit}
    />
  );
}
