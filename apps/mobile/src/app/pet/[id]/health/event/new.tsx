import { HEALTH_EVENT_FORM_DEFAULTS, type HealthEventFormValues, healthEventFormToData } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { createHealthEvent } from '@/features/health/health.repo';
import { HealthEventForm } from '@/features/health/HealthEventForm';
import { useReminderPermission } from '@/features/reminders/usePermission';

export default function NewHealthEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('health');
  const router = useRouter();
  const user = useUser();
  const permission = useReminderPermission();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const onSubmit = async (values: HealthEventFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const { id: eid, status } = await createHealthEvent(id, user.uid, healthEventFormToData(values));
      track({ name: 'health_event_created' });
      if (values.nextDate && permission.state === 'undetermined') await permission.request();
      if (status === 'pending') Alert.alert(t('form.savePending'));
      router.replace({ pathname: '/pet/[id]/health/event/[eid]', params: { id, eid } });
    } catch (e) {
      reportError('health.createEvent', e);
      setError(t('form.saveFailed'));
      setSubmitting(false);
    }
  };

  return <HealthEventForm isNew initialValues={HEALTH_EVENT_FORM_DEFAULTS} submitting={submitting} submitError={error} onSubmit={onSubmit} />;
}
