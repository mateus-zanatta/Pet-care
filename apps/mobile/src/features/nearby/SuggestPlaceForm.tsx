import { zodResolver } from '@hookform/resolvers/zod';
import {
  PLACE_CATEGORY,
  type PlaceCategory,
  type PlaceSuggestionForm,
  type PlaceSuggestionRequest,
  placeSuggestionFormSchema,
  suggestionFormToRequest,
} from '@petcare/shared';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormChoice, FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { callFunction } from '@/core/firebase/callable';

type Props = {
  initial: PlaceSuggestionForm;
  /** Só quem tem conta sugere (reduz spam). */
  canSend: boolean;
  onDone: () => void;
};

export function SuggestPlaceForm({ initial, canSend, onDone }: Props) {
  const { t } = useTranslation('nearby');
  const { t: tc } = useTranslation();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const { control, handleSubmit, formState } = useForm<PlaceSuggestionForm>({
    resolver: zodResolver(placeSuggestionFormSchema),
    defaultValues: initial,
    mode: 'onTouched',
  });
  const { errors, isSubmitted } = formState;
  const fix = initial.kind === 'fix';

  const submit = async (values: PlaceSuggestionForm) => {
    setSending(true);
    setError(undefined);
    try {
      await callFunction<PlaceSuggestionRequest, { ok: boolean }>('suggestPlace', suggestionFormToRequest(values));
      track({ name: 'place_suggestion', kind: values.kind });
      Alert.alert(t('suggest.sent'));
      onDone();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'functions/resource-exhausted') setError(t('suggest.limit'));
      else if (code === 'functions/permission-denied') setError(t('suggest.needAccount'));
      else {
        reportError('nearby.suggest', e);
        setError(t('suggest.failed'));
      }
    } finally {
      setSending(false);
    }
  };

  const categoryOptions = PLACE_CATEGORY.map((value: PlaceCategory) => ({ value, label: t(`category.${value}`) }));

  return (
    <Screen
      keyboard
      footer={
        <Button
          label={sending ? t('suggest.sending') : t('suggest.send')}
          icon="send"
          loading={sending}
          disabled={!canSend}
          onPress={handleSubmit(submit)}
        />
      }
    >
      <AppText variant="title">{fix ? t('suggest.titleFix') : t('suggest.titleNew')}</AppText>
      <AppText color="textMuted">{t('suggest.intro')}</AppText>
      {!canSend ? <Banner tone="warning">{t('suggest.needAccount')}</Banner> : null}
      {isSubmitted && Object.keys(errors).length > 0 ? <Banner tone="error">{t('suggest.failed')}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <FormTextField control={control} name="name" label={t('suggest.name')} maxLength={120} autoCapitalize="words" />
      <FormChoice control={control} name="category" label={t('suggest.category')} options={categoryOptions} />
      <FormTextField control={control} name="address" label={t('suggest.address')} maxLength={200} />
      <FormTextField control={control} name="phone" label={t('suggest.phone')} keyboardType="phone-pad" maxLength={40} />
      <Controller
        control={control}
        name="is24h"
        render={({ field }) => (
          <Checkbox checked={field.value} onChange={field.onChange} accessibilityLabel={t('suggest.is24h')}>
            <AppText>{t('suggest.is24h')}</AppText>
          </Checkbox>
        )}
      />
      <FormTextField control={control} name="note" label={t('suggest.note')} optional={tc('optional')} multiline maxLength={500} />
    </Screen>
  );
}
