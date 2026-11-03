import { VACCINE_FORM_DEFAULTS, type VaccineFormValues, vaccineFormToData } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { createVaccine } from '@/features/health/health.repo';
import { VaccineForm } from '@/features/health/VaccineForm';
import { useReminderPermission } from '@/features/reminders/usePermission';

export default function NewVaccineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('health');
  const router = useRouter();
  const user = useUser();
  const permission = useReminderPermission();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const onSubmit = async (values: VaccineFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const { id: vid, status } = await createVaccine(id, user.uid, vaccineFormToData(values));
      track({ name: 'vaccine_created' });
      // O pedido de permissão vem NO MOMENTO em que a pessoa combina uma próxima dose.
      if (values.nextDoseOn && permission.state === 'undetermined') await permission.request();
      if (status === 'pending') Alert.alert(t('form.savePending'));
      // Abre a vacina salva, onde a pessoa pode anexar fotos e PDFs.
      router.replace({ pathname: '/pet/[id]/health/vaccine/[vid]', params: { id, vid } });
    } catch (e) {
      reportError('health.createVaccine', e);
      setError(t('form.saveFailed'));
      setSubmitting(false);
    }
  };

  return <VaccineForm isNew initialValues={VACCINE_FORM_DEFAULTS} submitting={submitting} submitError={error} onSubmit={onSubmit} />;
}
