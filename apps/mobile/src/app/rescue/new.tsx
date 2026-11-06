import { zodResolver } from '@hookform/resolvers/zod';
import { MAX_CENTRAL_PHOTOS, RESCUE_ANIMAL_KIND, RESCUE_CONDITION, type RescueAlertInput, isWildRescue, rescueAlertInputSchema } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormChoice, FormTextField, useErrorText } from '@/components/form/FormFields';
import { useItemEnter } from '@/components/motion/motion';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { MultiChips } from '@/components/ui/MultiChips';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { createRescueAlert, updateRescueAlert, uploadCentralPhotos } from '@/features/centrals/centrals.repo';
import { PhotoStrip } from '@/features/centrals/components';
import { centralErrorKey } from '@/features/centrals/errors';
import { LocationPicker } from '@/features/centrals/LocationPicker';
import type { PickedPhoto } from '@/features/pets/pets.repo';
import { OfficialContacts } from '@/features/rescue/OfficialContacts';

type FormIn = z.input<typeof rescueAlertInputSchema>;

/** Anunciar um LOCAL onde há um animal (qualquer espécie) precisando de resgate. */
export default function NewRescueAlertScreen() {
  const { t } = useTranslation('rescue');
  const { t: tc } = useTranslation('centrals');
  const errorText = useErrorText();
  const router = useRouter();
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [countText, setCountText] = useState('1');
  const itemEnter = useItemEnter();
  const { control, handleSubmit, setValue, formState } = useForm<FormIn, unknown, RescueAlertInput>({
    resolver: zodResolver(rescueAlertInputSchema),
    defaultValues: { animalKind: 'dog', conditions: [], count: 1, description: '', address: '', reference: '', contactPhone: '' },
  });
  const kind = useWatch({ control, name: 'animalKind' });
  const lat = useWatch({ control, name: 'lat' });
  const lng = useWatch({ control, name: 'lng' });

  const submit = handleSubmit(async (values) => {
    setSaving(true);
    setError(undefined);
    try {
      const { id } = await createRescueAlert(values);
      track({ name: 'central_created', central: 'rescue' });
      if (picked.length) {
        try {
          await updateRescueAlert({ id, photoPaths: await uploadCentralPhotos('rescue', id, [], picked) });
        } catch {
          Alert.alert(tc('photos.failed'));
        }
      }
      router.replace({ pathname: '/rescue/[id]', params: { id } });
    } catch (e) {
      reportError('rescue.create', e);
      setError(tc(centralErrorKey(e)));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Screen keyboard>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={{ gap: 16 }}>
        <AppText color="textMuted">{t('form.intro')}</AppText>
        <FormChoice control={control} name="animalKind" label={t('form.kind')} options={RESCUE_ANIMAL_KIND.map((value) => ({ value, label: t(`kinds.${value}`) }))} />
        {isWildRescue(kind) ? (
          <Animated.View entering={itemEnter} style={{ gap: 12 }}>
            <Banner tone="warning">{t('form.wildWarning')}</Banner>
            <OfficialContacts kind={kind} />
          </Animated.View>
        ) : null}
        <Controller
          control={control}
          name="conditions"
          render={({ field, fieldState }) => (
            <MultiChips
              label={t('form.conditions')}
              options={RESCUE_CONDITION.map((value) => ({ value, label: t(`conditions.${value}`) }))}
              value={field.value ?? []}
              onChange={field.onChange}
              error={errorText(fieldState.error?.message)}
            />
          )}
        />
        <TextField
          label={t('form.count')}
          value={countText}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(text) => {
            setCountText(text);
            const n = Number(text);
            setValue('count', Number.isInteger(n) && n > 0 ? n : 0, { shouldValidate: formState.isSubmitted });
          }}
          error={formState.errors.count ? t('form.countError') : undefined}
        />
        <FormTextField control={control} name="description" label={t('form.description')} hint={t('form.descriptionHint')} multiline />
      </View>

      <View style={{ gap: 16 }}>
        <LocationPicker
          value={lat !== undefined && lng !== undefined ? { lat, lng } : null}
          onChange={(p) => {
            if (!p) return;
            setValue('lat', p.lat, { shouldValidate: formState.isSubmitted });
            setValue('lng', p.lng, { shouldValidate: formState.isSubmitted });
          }}
          help={t('form.locationHelp')}
          error={formState.errors.lat ? t('form.locationRequired') : undefined}
        />
        <FormTextField control={control} name="address" label={t('form.address')} />
        <FormTextField control={control} name="reference" label={t('form.reference')} hint={t('form.referenceHint')} />
        <FormTextField control={control} name="contactPhone" label={t('form.contactPhone')} hint={t('form.contactHint')} keyboardType="phone-pad" />
        <PhotoStrip picked={picked} max={MAX_CENTRAL_PHOTOS} onPick={(p) => setPicked((l) => [...l, p])} onRemovePicked={(i) => setPicked((l) => l.filter((_, idx) => idx !== i))} />
      </View>

      <Button variant="accent" icon="megaphone" label={t('form.submit')} loading={saving} onPress={submit} testID="rescue-submit" />
    </Screen>
  );
}
