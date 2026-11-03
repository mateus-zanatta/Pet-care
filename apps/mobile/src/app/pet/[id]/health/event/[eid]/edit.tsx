import { type HealthEventFormValues, healthEventFormToData, healthEventToFormValues } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { reportError } from '@/core/errors/report';
import { updateHealthEvent } from '@/features/health/health.repo';
import { useHealthEvents } from '@/features/health/hooks';
import { HealthEventForm } from '@/features/health/HealthEventForm';

export default function EditHealthEventScreen() {
  const { id, eid } = useLocalSearchParams<{ id: string; eid: string }>();
  const { t } = useTranslation('health');
  const router = useRouter();
  const { data, loading } = useHealthEvents(id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (loading) return <LoadingView />;
  const event = data.find((e) => e.id === eid);
  if (!event) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('event.notFound')} body="" />
      </Screen>
    );
  }

  const onSubmit = async (values: HealthEventFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const status = await updateHealthEvent(id, event.id, healthEventFormToData(values));
      if (status === 'pending') Alert.alert(t('form.savePending'));
      router.back();
    } catch (e) {
      reportError('health.updateEvent', e);
      setError(t('form.saveFailed'));
      setSubmitting(false);
    }
  };

  return <HealthEventForm key={event.id} initialValues={healthEventToFormValues(event)} submitting={submitting} submitError={error} onSubmit={onSubmit} />;
}
