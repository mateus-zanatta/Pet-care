import { zodResolver } from '@hookform/resolvers/zod';
import {
  ADOPTION_SPECIES,
  AGE_GROUP,
  ANIMAL_SIZE,
  type AdoptionInput,
  MAX_CENTRAL_PHOTOS,
  SEX,
  TRISTATE,
  adoptionInputSchema,
} from '@petcare/shared';
import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { z } from 'zod';
import { FormChoice, FormTextField, useErrorText } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { MultiChips } from '@/components/ui/MultiChips';
import { Screen } from '@/components/ui/Screen';
import { HealthListEditor, PhotoStrip } from '@/features/centrals/components';
import { LocationPicker } from '@/features/centrals/LocationPicker';
import type { PickedPhoto } from '@/features/pets/pets.repo';
import { COLOR_KEYS } from './labels';

export type AdoptionFormValues = z.input<typeof adoptionInputSchema>;
export type AdoptionPhotos = { keep: string[]; picked: PickedPhoto[] };

const DEFAULTS: AdoptionFormValues = {
  species: 'dog',
  name: '',
  sex: 'unknown',
  ageGroup: 'adult',
  breed: '',
  colors: [],
  size: undefined,
  neutered: 'unknown',
  vaccines: [],
  medications: [],
  exams: [],
  healthNotes: '',
  description: '',
  city: '',
  uf: '' as AdoptionFormValues['uf'],
  contactPhone: '',
};

type Props = {
  initial?: Partial<AdoptionFormValues>;
  initialPhotos?: string[];
  submitLabel: string;
  submitting: boolean;
  submitError?: string;
  onSubmit: (values: AdoptionInput, photos: AdoptionPhotos) => void;
};

/** Formulário do anúncio de adoção: animal, saúde (vacinas, remédios, exames), local aproximado, contato e fotos. */
export function AdoptionForm({ initial, initialPhotos = [], submitLabel, submitting, submitError, onSubmit }: Props) {
  const { t } = useTranslation('adoption');
  const { t: tp } = useTranslation('pets');
  const errorText = useErrorText();
  const [keep, setKeep] = useState(initialPhotos);
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const { control, handleSubmit, setValue, formState } = useForm<AdoptionFormValues, unknown, AdoptionInput>({
    resolver: zodResolver(adoptionInputSchema),
    defaultValues: { ...DEFAULTS, ...initial },
  });
  const lat = useWatch({ control, name: 'lat' });
  const lng = useWatch({ control, name: 'lng' });
  const hasErrors = formState.isSubmitted && Object.keys(formState.errors).length > 0;

  const species = ADOPTION_SPECIES.map((value) => ({ value, label: t(`species.${value}`) }));
  const sexes = SEX.map((value) => ({ value, label: tp(`sex.${value}`) }));
  const ages = AGE_GROUP.map((value) => ({ value, label: t(`age.${value}`) }));
  const sizes = ANIMAL_SIZE.map((value) => ({ value, label: t(`size.${value}`) }));
  const tri = TRISTATE.map((value) => ({ value, label: tp(`tristate.${value}`) }));
  const colors = COLOR_KEYS.map((value) => ({ value, label: t(`colors.${value}`) }));

  const healthList = (name: 'vaccines' | 'medications' | 'exams') => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <HealthListEditor
          label={t(`form.${name}`)}
          addLabel={t(`form.${name}Add`)}
          namePlaceholder={t(`form.${name}Placeholder`)}
          items={(field.value ?? []).map((i) => ({ name: i.name, date: i.date, note: i.note ?? undefined }))}
          onChange={field.onChange}
          error={fieldState.error ? t('form.healthItemError') : undefined}
        />
      )}
    />
  );

  return (
    <Screen keyboard>
      {submitError ? <Banner tone="error">{submitError}</Banner> : null}
      {hasErrors ? <Banner tone="error">{t('form.fixErrors')}</Banner> : null}

      <View style={{ gap: 16 }}>
        <AppText variant="title">{t('form.sectionAnimal')}</AppText>
        <FormChoice control={control} name="species" label={t('form.species')} options={species} />
        <FormTextField control={control} name="name" label={t('form.name')} hint={t('form.nameHint')} />
        <FormChoice control={control} name="sex" label={t('form.sex')} options={sexes} />
        <FormChoice control={control} name="ageGroup" label={t('form.age')} options={ages} />
        <FormTextField control={control} name="breed" label={t('form.breed')} hint={t('form.breedHint')} />
        <Controller
          control={control}
          name="colors"
          render={({ field, fieldState }) => (
            <MultiChips label={t('form.colors')} options={colors} value={field.value ?? []} onChange={field.onChange} max={5} error={errorText(fieldState.error?.message)} />
          )}
        />
        <Controller
          control={control}
          name="size"
          render={({ field }) => (
            <MultiChips
              label={t('form.size')}
              options={sizes}
              value={field.value ? [field.value] : []}
              onChange={(v) => field.onChange(v[v.length - 1])}
            />
          )}
        />
        <FormChoice control={control} name="neutered" label={t('form.neutered')} options={tri} />
      </View>

      <View style={{ gap: 16 }}>
        <AppText variant="title">{t('form.sectionHealth')}</AppText>
        <AppText color="textMuted">{t('form.healthHelp')}</AppText>
        {healthList('vaccines')}
        {healthList('medications')}
        {healthList('exams')}
        <FormTextField control={control} name="healthNotes" label={t('form.healthNotes')} multiline />
      </View>

      <View style={{ gap: 16 }}>
        <AppText variant="title">{t('form.sectionAbout')}</AppText>
        <FormTextField control={control} name="description" label={t('form.description')} hint={t('form.descriptionHint')} multiline />
        <PhotoStrip
          paths={keep}
          picked={picked}
          max={MAX_CENTRAL_PHOTOS}
          onPick={(p) => setPicked((list) => [...list, p])}
          onRemovePath={(p) => setKeep((list) => list.filter((x) => x !== p))}
          onRemovePicked={(i) => setPicked((list) => list.filter((_, idx) => idx !== i))}
        />
      </View>

      <View style={{ gap: 16 }}>
        <AppText variant="title">{t('form.sectionWhere')}</AppText>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 3 }}>
            <FormTextField control={control} name="city" label={t('form.city')} autoComplete="off" />
          </View>
          <View style={{ flex: 1 }}>
            <FormTextField control={control} name="uf" label={t('form.uf')} autoCapitalize="characters" maxLength={2} />
          </View>
        </View>
        <LocationPicker
          value={lat !== undefined && lng !== undefined ? { lat, lng } : null}
          onChange={(p) => {
            setValue('lat', p?.lat);
            setValue('lng', p?.lng);
          }}
          help={t('form.locationHelp')}
        />
        <FormTextField control={control} name="contactPhone" label={t('form.contactPhone')} hint={t('form.contactHint')} keyboardType="phone-pad" autoComplete="tel" />
      </View>

      <Button
        variant="accent"
        icon="heart"
        label={submitLabel}
        loading={submitting}
        onPress={handleSubmit((values) => onSubmit(values, { keep, picked }))}
        testID="adoption-submit"
      />
    </Screen>
  );
}
