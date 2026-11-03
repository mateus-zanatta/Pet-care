import { type VaccineFormValues, vaccineFormToData, vaccineToFormValues } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { reportError } from '@/core/errors/report';
import { updateVaccine } from '@/features/health/health.repo';
import { useVaccines } from '@/features/health/hooks';
import { VaccineForm } from '@/features/health/VaccineForm';

export default function EditVaccineScreen() {
  const { id, vid } = useLocalSearchParams<{ id: string; vid: string }>();
  const { t } = useTranslation('health');
  const router = useRouter();
  const { data, loading } = useVaccines(id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <LoadingView />;
  const vaccine = data.find((v) => v.id === vid);
  if (!vaccine) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('vaccine.notFound')} body="" />
      </Screen>
    );
  }

  const onSubmit = async (values: VaccineFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const status = await updateVaccine(id, vaccine.id, vaccineFormToData(values));
      if (status === 'pending') Alert.alert(t('form.savePending'));
      router.back();
    } catch (e) {
      reportError('health.updateVaccine', e);
      setError(t('form.saveFailed'));
      setSubmitting(false);
    }
  };

  return <VaccineForm key={vaccine.id} initialValues={vaccineToFormValues(vaccine)} submitting={submitting} submitError={error} onSubmit={onSubmit} />;
}
