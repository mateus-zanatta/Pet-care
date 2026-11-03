import { zodResolver } from '@hookform/resolvers/zod';
import {
  type PetFormValues,
  SEX,
  SPECIES,
  TRISTATE,
  isRgaFormatValid,
  petFormSchema,
} from '@petcare/shared';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormChoice, FormDate, FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import type { FieldBadgeInfo } from '@/components/ui/FieldBadge';
import { Screen } from '@/components/ui/Screen';
import { dateOrderFor } from '@/core/dates';
import { PermissionDeniedError, pickFromGallery, takePhoto } from './usePhotoPicker';
import { PetPhoto } from './PetPhoto';
import type { PickedPhoto } from './pets.repo';

export type PhotoChange = { kind: 'none' } | { kind: 'picked'; photo: PickedPhoto } | { kind: 'removed' };

/** Escolhas extras da importação do RG Animal (nada é salvo sem a pessoa marcar). */
export type FormExtras = { saveTutor: boolean };

type Props = {
  initialValues: PetFormValues;
  /** Foto já salva (edição). */
  currentPhotoUrl: string | null;
  submitting: boolean;
  submitError?: string;
  onSubmit: (values: PetFormValues, photo: PhotoChange, extras: FormExtras) => void;
  /** Selos "lido do RG" / "confira" por campo (importação do RG Animal). */
  badges?: Partial<Record<keyof PetFormValues, 'rga' | 'check'>>;
  /** Conteúdo no topo do formulário (avisos, atalhos). */
  headerSlot?: React.ReactNode;
  /** Foto do animal lida do RG: oferecida como foto de perfil. */
  rgaPhoto?: { uri: string; base64: string };
  /** Responsável lido do RG: só é salvo se a pessoa marcar. */
  rgaTutor?: { nome?: string; telefone?: string };
  submitLabel?: string;
  submittingLabel?: string;
};

export function PetForm({
  initialValues,
  currentPhotoUrl,
  submitting,
  submitError,
  onSubmit,
  badges,
  headerSlot,
  rgaPhoto,
  rgaTutor,
  submitLabel,
  submittingLabel,
}: Props) {
  const { t, i18n } = useTranslation('pets');
  const { t: tc } = useTranslation();
  const { t: te } = useTranslation('errors');
  const { t: tr } = useTranslation('rga');
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';
  const order = dateOrderFor(locale);

  const { control, handleSubmit, formState } = useForm<PetFormValues>({
    resolver: zodResolver(petFormSchema),
    defaultValues: initialValues,
    mode: 'onTouched',
  });
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'none' });
  const [photoError, setPhotoError] = useState<string>();
  const [useRgaPhoto, setUseRgaPhoto] = useState(true);
  const [saveTutor, setSaveTutor] = useState(false);

  const badgeFor = (name: keyof PetFormValues): FieldBadgeInfo | undefined => {
    const kind = badges?.[name];
    return kind ? { kind, label: tr(`badge.${kind}`) } : undefined;
  };

  const birthMode = useWatch({ control, name: 'birthMode' });
  const rga = useWatch({ control, name: 'rga' });
  const showRgaWarning = rga.trim() !== '' && !isRgaFormatValid(rga);

  // A foto do RG vale como foto de perfil enquanto a pessoa não escolher outra (e não desmarcar).
  const effectivePhoto: PhotoChange =
    photo.kind === 'none' && rgaPhoto && useRgaPhoto
      ? { kind: 'picked', photo: { uri: rgaPhoto.uri, width: 0, height: 0, base64: rgaPhoto.base64 } }
      : photo;
  const previewUrl =
    effectivePhoto.kind === 'picked'
      ? effectivePhoto.photo.uri
      : effectivePhoto.kind === 'removed'
        ? null
        : currentPhotoUrl;

  const pick = async (source: 'gallery' | 'camera') => {
    setPhotoError(undefined);
    try {
      const picked = source === 'gallery' ? await pickFromGallery() : await takePhoto();
      if (picked) setPhoto({ kind: 'picked', photo: picked });
    } catch (error) {
      if (error instanceof PermissionDeniedError) setPhotoError(te('permissions.cameraDenied'));
      else setPhotoError(te('generic'));
    }
  };

  const openPhotoMenu = () => {
    Alert.alert(t('form.photo'), undefined, [
      { text: t('form.photoFromGallery'), onPress: () => void pick('gallery') },
      { text: t('form.photoFromCamera'), onPress: () => void pick('camera') },
      ...(previewUrl
        ? [{ text: t('form.photoRemove'), style: 'destructive' as const, onPress: () => setPhoto({ kind: 'removed' }) }]
        : []),
      { text: tc('actions.cancel'), style: 'cancel' as const },
    ]);
  };

  const speciesOptions = SPECIES.map((value) => ({ value, label: t(`species.${value}`) }));
  const sexOptions = SEX.map((value) => ({ value, label: t(`sex.${value}`) }));
  const neuteredOptions = TRISTATE.map((value) => ({ value, label: t(`tristate.${value}`) }));
  const birthOptions = (['date', 'age', 'unknown'] as const).map((value) => ({
    value,
    label: t(`birthMode.${value}`),
  }));

  return (
    <Screen
      keyboard
      footer={
        <Button
          label={submitting ? (submittingLabel ?? t('form.saving')) : (submitLabel ?? t('form.save'))}
          icon="checkmark"
          loading={submitting}
          onPress={handleSubmit((values) => onSubmit(values, effectivePhoto, { saveTutor }))}
        />
      }
    >
      {headerSlot}
      {formState.isSubmitted && !formState.isValid ? <Banner tone="error">{t('form.fixErrors')}</Banner> : null}
      {submitError ? <Banner tone="error">{submitError}</Banner> : null}

      <View style={{ alignItems: 'center', gap: 8 }}>
        <PetPhoto url={previewUrl} size={112} />
        <Button
          variant="secondary"
          icon="camera"
          label={previewUrl ? t('form.photoChange') : t('form.photoAdd')}
          onPress={openPhotoMenu}
        />
        <AppText variant="caption" color="textMuted" align="center">
          {t('form.photoHint')}
        </AppText>
        {photoError ? <Banner tone="warning">{photoError}</Banner> : null}
        {rgaPhoto && photo.kind === 'none' ? (
          <Checkbox checked={useRgaPhoto} onChange={setUseRgaPhoto} accessibilityLabel={tr('review.photo')}>
            <AppText>{tr('review.photo')}</AppText>
          </Checkbox>
        ) : null}
      </View>

      <AppText variant="title">{t('form.basics')}</AppText>
      <FormTextField
        control={control}
        name="name"
        label={t('form.name')}
        badge={badgeFor('name')}
        autoCapitalize="words"
        maxLength={60}
      />
      <FormChoice control={control} name="species" label={t('form.species')} options={speciesOptions} badge={badgeFor('species')} />
      <FormTextField
        control={control}
        name="breed"
        label={t('form.breed')}
        optional={tc('optional')}
        autoCapitalize="words"
      />
      <FormChoice control={control} name="sex" label={t('form.sex')} options={sexOptions} badge={badgeFor('sex')} />
      <FormChoice control={control} name="neutered" label={t('form.neutered')} options={neuteredOptions} badge={badgeFor('neutered')} />

      <AppText variant="title">{t('form.birth')}</AppText>
      <FormChoice control={control} name="birthMode" label={t('form.birth')} options={birthOptions} />
      {birthMode === 'date' ? (
        <FormDate
          control={control}
          name="birthDate"
          label={t('form.birthDate')}
          order={order}
          placeholder={t('form.birthDatePlaceholder')}
          badge={badgeFor('birthDate')}
        />
      ) : null}
      {birthMode === 'age' ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <FormTextField control={control} name="ageYears" label={t('form.ageYears')} keyboardType="number-pad" maxLength={2} />
          </View>
          <View style={{ flex: 1 }}>
            <FormTextField control={control} name="ageMonths" label={t('form.ageMonths')} keyboardType="number-pad" maxLength={2} />
          </View>
        </View>
      ) : null}
      <FormTextField
        control={control}
        name="weight"
        label={t('form.weight')}
        optional={tc('optional')}
        keyboardType="decimal-pad"
      />

      <AppText variant="title">{t('form.identification')}</AppText>
      <FormTextField
        control={control}
        name="microchip"
        label={t('form.microchip')}
        badge={badgeFor('microchip')}
        optional={tc('optional')}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <FormTextField
        control={control}
        name="rga"
        label={t('form.rga')}
        badge={badgeFor('rga')}
        hint={t('form.rgaHint')}
        optional={tc('optional')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={20}
      />
      {showRgaWarning ? <Banner tone="warning">{t('form.rgaFormatWarning')}</Banner> : null}
      <FormTextField control={control} name="cor" label={t('form.cor')} optional={tc('optional')} badge={badgeFor('cor')} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 3 }}>
          <FormTextField
            control={control}
            name="naturalCity"
            label={t('form.naturalCity')}
            optional={tc('optional')}
            badge={badgeFor('naturalCity')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormTextField
            control={control}
            name="naturalUf"
            label={t('form.naturalUf')}
            badge={badgeFor('naturalUf')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
          />
        </View>
      </View>

      <AppText variant="title">{t('form.health')}</AppText>
      <FormTextField control={control} name="allergies" label={t('form.allergies')} optional={tc('optional')} multiline />
      <FormTextField control={control} name="notes" label={t('form.notes')} optional={tc('optional')} multiline />

      <AppText variant="title">{t('form.home')}</AppText>
      <FormTextField
        control={control}
        name="addressText"
        label={t('form.address')}
        hint={t('form.addressHint')}
        optional={tc('optional')}
      />

      {rgaTutor ? (
        <Checkbox checked={saveTutor} onChange={setSaveTutor} accessibilityLabel={tr('review.tutor')}>
          <View style={{ gap: 4 }}>
            <AppText>{tr('review.tutor')}</AppText>
            <AppText variant="caption" color="textMuted">
              {[rgaTutor.nome, rgaTutor.telefone].filter(Boolean).join(' · ')}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {tr('review.tutorHint')}
            </AppText>
          </View>
        </Checkbox>
      ) : null}
    </Screen>
  );
}
