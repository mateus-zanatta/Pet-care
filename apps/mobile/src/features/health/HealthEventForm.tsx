import { zodResolver } from '@hookform/resolvers/zod';
import { HEALTH_EVENT_TYPE, type HealthEventFormValues, healthEventFormSchema } from '@petcare/shared';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormChoice, FormDate, FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { dateOrderFor } from '@/core/dates';
import { VetFields } from './VetFields';

type Props = {
  initialValues: HealthEventFormValues;
  submitting: boolean;
  submitError?: string;
  isNew?: boolean;
  onSubmit: (values: HealthEventFormValues) => void;
};

export function HealthEventForm({ initialValues, submitting, submitError, isNew, onSubmit }: Props) {
  const { t, i18n } = useTranslation('health');
  const { t: tp } = useTranslation('pets');
  const { t: tc } = useTranslation();
  const order = dateOrderFor(i18n.language === 'en' ? 'en' : 'pt-BR');
  const placeholder = tp('form.birthDatePlaceholder');

  const { control, handleSubmit, formState } = useForm<HealthEventFormValues>({
    resolver: zodResolver(healthEventFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });

  // O aviso depende dos ERROS reais (e não de `isValid`): o React Hook Form só calcula `isValid` se ele for lido já
  // na 1ª renderização, e um formulário válido ficava mostrando "Confira os campos destacados".
  const { errors, isSubmitted } = formState;
  const showFixErrors = isSubmitted && Object.keys(errors).length > 0;

  const typeOptions = HEALTH_EVENT_TYPE.map((value) => ({ value, label: t(`eventType.${value}`) }));

  return (
    <Screen
      keyboard
      footer={<Button label={submitting ? t('form.saving') : t('event.save')} icon="checkmark" loading={submitting} onPress={handleSubmit(onSubmit)} />}
    >
      <Banner tone="info">{t('disclaimer')}</Banner>
      {showFixErrors ? <Banner tone="error">{t('form.fixErrors')}</Banner> : null}
      {submitError ? <Banner tone="error">{submitError}</Banner> : null}

      <FormChoice control={control} name="type" label={t('event.type')} options={typeOptions} />
      <FormTextField control={control} name="title" label={t('event.title')} maxLength={80} />
      <FormDate control={control} name="date" label={t('event.date')} order={order} placeholder={placeholder} />
      <FormTextField control={control} name="description" label={t('event.description')} optional={tc('optional')} multiline maxLength={1000} />
      <FormDate control={control} name="nextDate" label={t('event.nextDate')} order={order} placeholder={placeholder} />
      <AppText variant="caption" color="textMuted">
        {t('event.reminderHint')}
      </AppText>

      <AppText variant="title">{t('form.sectionVet')}</AppText>
      <VetFields control={control} />
      {isNew ? (
        <AppText variant="caption" color="textMuted">
          {t('form.attachmentsAfterSave')}
        </AppText>
      ) : null}
    </Screen>
  );
}
