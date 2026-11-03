import { medicationFormDefaults, medicationFormToData, type MedicationFormValues } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { createMedication } from '@/features/medications/medications.repo';
import { MedicationForm } from '@/features/medications/MedicationForm';
import { useReminderPermission } from '@/features/reminders/usePermission';

export default function NewMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('meds');
  const router = useRouter();
  const user = useUser();
  const permission = useReminderPermission();
  const initialValues = useMemo(() => medicationFormDefaults(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const onSubmit = async (values: MedicationFormValues) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const { status } = await createMedication(id, user.uid, medicationFormToData(values));
      track({ name: 'medication_created' });
      // O pedido de permissão vem NO MOMENTO em que a pessoa cria o primeiro lembrete (contexto claro).
      if (permission.state === 'undetermined') await permission.request();
      if (status === 'pending') Alert.alert(t('form.savePending'));
      router.back();
    } catch (e) {
      reportError('medications.create', e);
      setError(t('form.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return <MedicationForm initialValues={initialValues} submitting={submitting} submitError={error} onSubmit={onSubmit} />;
}
