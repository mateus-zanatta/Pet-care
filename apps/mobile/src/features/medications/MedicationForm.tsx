import { zodResolver } from '@hookform/resolvers/zod';
import {
  FREQUENCY_KIND,
  MEDICATION_PLACE,
  MEDICATION_ROUTE,
  MEDICATION_STATUS,
  MAX_FIXED_TIMES,
  type MedicationFormValues,
  isValidTime,
  medicationFormSchema,
} from '@petcare/shared';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormChoice, FormDate, FormTextField, useErrorText } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { dateOrderFor } from '@/core/dates';

type Props = {
  initialValues: MedicationFormValues;
  submitting: boolean;
  submitError?: string;
  /** Edição: mostra a situação (em uso / concluído / suspenso). */
  showStatus?: boolean;
  /** Abre a leitura do código de barras pela câmera (some se não houver). */
  onScan?: () => void;
  /** Código lido pela câmera: preenche o campo "Código de barras". */
  scannedCode?: string | null;
  /** Locais favoritos do "Perto de mim": aparecem como opção no campo "local". */
  favoritePlaces?: readonly { id: string; name: string; address?: string }[];
  onSubmit: (values: MedicationFormValues) => void;
};

/** "0830" -> "08:30": só dígitos, no máximo 4. */
export function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/**
 * Formulário de medicamento. REGRA DO PRODUTO: o app só REGISTRA o que o veterinário prescreveu —
 * não há sugestões, valores padrão de dose nem listas de medicamentos.
 */
export function MedicationForm({ initialValues, submitting, submitError, showStatus, onScan, scannedCode, favoritePlaces = [], onSubmit }: Props) {
  const { t, i18n } = useTranslation('meds');
  const { t: tp } = useTranslation('pets');
  const { t: tc } = useTranslation();
  const { t: tn } = useTranslation('nearby');
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const order = dateOrderFor(locale);

  const { control, handleSubmit, formState, setValue } = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });

  // O aviso depende dos ERROS reais (e não de `isValid`): o React Hook Form só calcula `isValid` se ele for lido já
  // na 1ª renderização, e um formulário válido ficava mostrando "Confira os campos destacados".
  const { errors, isSubmitted } = formState;
  const showFixErrors = isSubmitted && Object.keys(errors).length > 0;

  useEffect(() => {
    if (scannedCode) setValue('barcode', scannedCode, { shouldDirty: true, shouldValidate: true });
  }, [scannedCode, setValue]);

  const frequencyKind = useWatch({ control, name: 'frequencyKind' });
  const continuous = useWatch({ control, name: 'continuous' });
  const placeKind = useWatch({ control, name: 'placeKind' });

  const routeOptions = MEDICATION_ROUTE.map((value) => ({ value, label: t(`route.${value}`) }));
  const frequencyOptions = FREQUENCY_KIND.map((value) => ({ value, label: t(`frequency.${value}`) }));
  const placeOptions = MEDICATION_PLACE.map((value) => ({ value, label: t(`place.${value}`) }));
  const statusOptions = MEDICATION_STATUS.map((value) => ({ value, label: t(`status.${value}`) }));
  const durationOptions = [
    { value: 'ends' as const, label: t('form.durationEnds') },
    { value: 'continuous' as const, label: t('form.durationContinuous') },
  ];

  return (
    <Screen
      keyboard
      footer={
        <Button
          label={submitting ? t('form.saving') : t('form.save')}
          icon="checkmark"
          loading={submitting}
          onPress={handleSubmit(onSubmit)}
        />
      }
    >
      <Banner tone="info">{t('disclaimer')}</Banner>
      {showFixErrors ? <Banner tone="error">{t('form.fixErrors')}</Banner> : null}
      {submitError ? <Banner tone="error">{submitError}</Banner> : null}

      <AppText variant="title">{t('form.sectionMedicine')}</AppText>
      <FormTextField control={control} name="name" label={t('form.name')} autoCapitalize="words" maxLength={80} />
      <FormTextField
        control={control}
        name="barcode"
        label={t('form.barcode')}
        keyboardType="number-pad"
        autoCorrect={false}
        maxLength={64}
      />
      {onScan ? <Button variant="secondary" icon="barcode" label={t('form.scan')} onPress={onScan} /> : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <FormTextField control={control} name="batch" label={t('form.batch')} optional={tc('optional')} autoCapitalize="characters" maxLength={40} />
        </View>
        <View style={{ flex: 1 }}>
          <FormDate
            control={control}
            name="expiresOn"
            label={t('form.expiresOn')}
            order={order}
            placeholder={tp('form.birthDatePlaceholder')}
          />
        </View>
      </View>

      <AppText variant="title">{t('form.sectionDose')}</AppText>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <FormTextField control={control} name="doseAmount" label={t('form.doseAmount')} hint={t('form.doseAmountHint')} maxLength={20} autoCorrect={false} />
        </View>
        <View style={{ flex: 1 }}>
          <FormTextField control={control} name="doseUnit" label={t('form.doseUnit')} hint={t('form.doseUnitHint')} maxLength={20} />
        </View>
      </View>
      <FormChoice control={control} name="route" label={t('form.route')} options={routeOptions} />

      <AppText variant="title">{t('form.sectionSchedule')}</AppText>
      <FormChoice control={control} name="frequencyKind" label={t('form.frequencyKind')} options={frequencyOptions} />
      {frequencyKind === 'interval' ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <FormTextField control={control} name="everyHours" label={t('form.everyHours')} keyboardType="number-pad" maxLength={3} />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="startTime"
              render={({ field, fieldState }) => (
                <TimeInput
                  label={t('form.startTime')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={t('form.timePlaceholder')}
                  error={fieldState.error?.message}
                />
              )}
            />
          </View>
        </View>
      ) : (
        <Controller
          control={control}
          name="times"
          render={({ field, fieldState }) => (
            <TimesList value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
          )}
        />
      )}
      <FormDate
        control={control}
        name="startDate"
        label={t('form.startDate')}
        order={order}
        placeholder={tp('form.birthDatePlaceholder')}
      />
      <Controller
        control={control}
        name="continuous"
        render={({ field }) => (
          <ChoiceChips
            label={t('form.duration')}
            options={durationOptions}
            value={field.value ? 'continuous' : 'ends'}
            onChange={(value) => field.onChange(value === 'continuous')}
          />
        )}
      />
      {!continuous ? (
        <FormDate
          control={control}
          name="endDate"
          label={t('form.endDate')}
          order={order}
          placeholder={tp('form.birthDatePlaceholder')}
        />
      ) : null}
      <AppText variant="caption" color="textMuted">
        {t('form.reminderHint')}
      </AppText>

      <AppText variant="title">{t('form.sectionVet')}</AppText>
      <FormDate
        control={control}
        name="prescribedOn"
        label={t('form.prescribedOn')}
        order={order}
        placeholder={tp('form.birthDatePlaceholder')}
      />
      <FormTextField control={control} name="vetName" label={t('form.vetName')} optional={tc('optional')} autoCapitalize="words" maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 3 }}>
          <FormTextField control={control} name="crmvNumber" label={t('form.crmvNumber')} optional={tc('optional')} keyboardType="number-pad" maxLength={8} />
        </View>
        <View style={{ flex: 1 }}>
          <FormTextField control={control} name="crmvUf" label={t('form.crmvUf')} autoCapitalize="characters" autoCorrect={false} maxLength={2} />
        </View>
      </View>
      <FormChoice control={control} name="placeKind" label={t('form.placeKind')} options={placeOptions} />
      {favoritePlaces.length > 0 ? (
        <View style={{ gap: 8 }} testID="medication-favorite-places">
          <AppText variant="label">{tn('medicationFavorites')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {favoritePlaces.slice(0, 6).map((fav) => (
              <Button
                key={fav.id}
                variant="secondary"
                icon="star"
                label={fav.name}
                onPress={() => {
                  setValue('placeKind', 'clinic', { shouldDirty: true });
                  setValue('placeText', [fav.name, fav.address].filter(Boolean).join(' - ').slice(0, 200), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      {placeKind !== 'home' ? (
        <FormTextField
          control={control}
          name="placeText"
          label={placeKind === 'clinic' ? t('form.placeClinic') : t('form.placeAddress')}
          maxLength={200}
        />
      ) : null}

      <AppText variant="title">{t('form.sectionOther')}</AppText>
      {showStatus ? <FormChoice control={control} name="status" label={t('form.status')} options={statusOptions} /> : null}
      <FormTextField control={control} name="notes" label={t('form.notes')} optional={tc('optional')} multiline maxLength={1000} />
    </Screen>
  );
}

/* ----------------------------- Campos de horário ----------------------------- */

type TimeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  error?: string;
};

function TimeInput({ label, value, onChange, onBlur, placeholder, error }: TimeInputProps) {
  const errorText = useErrorText();
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(raw) => onChange(maskTimeInput(raw))}
      onBlur={onBlur}
      placeholder={placeholder}
      keyboardType="number-pad"
      maxLength={5}
      error={errorText(error)}
    />
  );
}

/** Horários fixos: digita HH:MM, toca em "Adicionar"; cada horário vira um botão que remove ao tocar. */
function TimesList({ value, onChange, error }: { value: string[]; onChange: (times: string[]) => void; error?: string }) {
  const { t } = useTranslation('meds');
  const errorText = useErrorText();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string>();

  const add = () => {
    if (!isValidTime(draft)) return setDraftError('validation.timeInvalid');
    if (value.includes(draft)) return setDraftError('validation.timesDuplicate');
    if (value.length >= MAX_FIXED_TIMES) return setDraftError('validation.timesTooMany');
    onChange([...value, draft].sort());
    setDraft('');
    setDraftError(undefined);
  };

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{t('form.times')}</AppText>
      <AppText variant="caption" color="textMuted">
        {t('form.timesHint')}
      </AppText>
      {value.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {value.map((time) => (
            <Button
              key={time}
              variant="secondary"
              icon="close-circle"
              label={time}
              accessibilityHint={t('form.removeTime', { time })}
              onPress={() => onChange(value.filter((x) => x !== time))}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('form.timeLabel')}
            value={draft}
            onChangeText={(raw) => setDraft(maskTimeInput(raw))}
            placeholder={t('form.timePlaceholder')}
            keyboardType="number-pad"
            maxLength={5}
            error={errorText(draftError)}
          />
        </View>
        <Button label={t('form.addTime')} icon="add" variant="secondary" onPress={add} />
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {errorText(error)}
        </AppText>
      ) : null}
    </View>
  );
}
