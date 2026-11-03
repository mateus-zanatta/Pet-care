import { zodResolver } from '@hookform/resolvers/zod';
import { type VaccineFormValues, vaccineFormSchema } from '@petcare/shared';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDate, FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { dateOrderFor } from '@/core/dates';
import { VetFields } from './VetFields';

type Props = {
  initialValues: VaccineFormValues;
  submitting: boolean;
  submitError?: string;
  /** Cadastro novo: lembra que os anexos entram depois de salvar. */
  isNew?: boolean;
  onSubmit: (values: VaccineFormValues) => void;
};

export function VaccineForm({ initialValues, submitting, submitError, isNew, onSubmit }: Props) {
  const { t, i18n } = useTranslation('health');
  const { t: tp } = useTranslation('pets');
  const { t: tc } = useTranslation();
  const order = dateOrderFor(i18n.language === 'en' ? 'en' : 'pt-BR');
  const placeholder = tp('form.birthDatePlaceholder');

  const { control, handleSubmit, formState } = useForm<VaccineFormValues>({
    resolver: zodResolver(vaccineFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });

  // O aviso depende dos ERROS reais (e não de `isValid`): o React Hook Form só calcula `isValid` se ele for lido já
  // na 1ª renderização, e um formulário válido ficava mostrando "Confira os campos destacados".
  const { errors, isSubmitted } = formState;
  const showFixErrors = isSubmitted && Object.keys(errors).length > 0;

  return (
    <Screen
      keyboard
      footer={<Button label={submitting ? t('form.saving') : t('vaccine.save')} icon="checkmark" loading={submitting} onPress={handleSubmit(onSubmit)} />}
    >
      <Banner tone="info">{t('disclaimer')}</Banner>
      {showFixErrors ? <Banner tone="error">{t('form.fixErrors')}</Banner> : null}
      {submitError ? <Banner tone="error">{submitError}</Banner> : null}

      <FormTextField control={control} name="name" label={t('vaccine.name')} autoCapitalize="words" maxLength={80} />
      <FormDate control={control} name="appliedOn" label={t('vaccine.appliedOn')} order={order} placeholder={placeholder} />
      <FormDate control={control} name="nextDoseOn" label={t('vaccine.nextDoseOn')} order={order} placeholder={placeholder} />
      <AppText variant="caption" color="textMuted">
        {t('vaccine.reminderHint')}
      </AppText>
      <FormTextField control={control} name="batch" label={t('vaccine.batch')} optional={tc('optional')} autoCapitalize="characters" maxLength={40} />

      <AppText variant="title">{t('form.sectionVet')}</AppText>
      <VetFields control={control} />
      <FormTextField control={control} name="notes" label={t('vaccine.notes')} optional={tc('optional')} multiline maxLength={1000} />
      {isNew ? (
        <AppText variant="caption" color="textMuted">
          {t('form.attachmentsAfterSave')}
        </AppText>
      ) : null}
    </Screen>
  );
}
