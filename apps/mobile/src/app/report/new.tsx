import { zodResolver } from '@hookform/resolvers/zod';
import { MAX_CENTRAL_PHOTOS, REPORT_TYPE, RESCUE_ANIMAL_KIND, type ReportInput, reportInputSchema } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormChoice, FormDate, FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { MultiChips } from '@/components/ui/MultiChips';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/core/analytics';
import { dateOrderFor } from '@/core/dates';
import { reportError } from '@/core/errors/report';
import { attachReportPhotos, createReport, uploadCentralPhotos } from '@/features/centrals/centrals.repo';
import { PhotoStrip } from '@/features/centrals/components';
import { centralErrorKey } from '@/features/centrals/errors';
import { LocationPicker } from '@/features/centrals/LocationPicker';
import type { PickedPhoto } from '@/features/pets/pets.repo';

type FormIn = z.input<typeof reportInputSchema>;

/** Denúncia de maus-tratos: privada, com limite diário, provas opcionais (fotos sem GPS) e opção de anonimato. */
export default function NewReportScreen() {
  const { t, i18n } = useTranslation('report');
  const { t: tr } = useTranslation('rescue');
  const { t: tc } = useTranslation('centrals');
  const router = useRouter();
  const order = dateOrderFor(i18n.language === 'en' ? 'en' : 'pt-BR');
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const { control, handleSubmit, setValue, formState } = useForm<FormIn, unknown, ReportInput>({
    resolver: zodResolver(reportInputSchema),
    defaultValues: { type: 'neglect', description: '', occurredOn: '', ongoing: false, address: '', reference: '', suspectInfo: '', anonymous: true },
  });
  const lat = useWatch({ control, name: 'lat' });
  const lng = useWatch({ control, name: 'lng' });

  const submit = handleSubmit(async (values) => {
    setSaving(true);
    setError(undefined);
    try {
      const { id } = await createReport({ ...values, occurredOn: values.occurredOn || undefined });
      track({ name: 'central_created', central: 'report' });
      if (picked.length) {
        try {
          await attachReportPhotos(id, await uploadCentralPhotos('report', id, [], picked));
        } catch {
          Alert.alert(tc('photos.failed'));
        }
      }
      router.replace({ pathname: '/report/[id]', params: { id, created: '1' } });
    } catch (e) {
      reportError('report.create', e);
      setError(tc(centralErrorKey(e)));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Screen keyboard>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={{ gap: 16 }}>
        <Banner tone="warning">{t('form.flagrant')}</Banner>
        <FormChoice control={control} name="type" label={t('form.type')} options={REPORT_TYPE.map((value) => ({ value, label: t(`types.${value}`) }))} />
        <FormTextField control={control} name="description" label={t('form.description')} hint={t('form.descriptionHint')} multiline />
        <FormDate control={control} name="occurredOn" label={t('form.occurredOn')} order={order} placeholder={tc('health.datePlaceholder')} />
        <Controller
          control={control}
          name="ongoing"
          render={({ field }) => (
            <Checkbox checked={Boolean(field.value)} onChange={field.onChange} accessibilityLabel={t('form.ongoing')}>
              <AppText>{t('form.ongoing')}</AppText>
            </Checkbox>
          )}
        />
        <Controller
          control={control}
          name="animalKind"
          render={({ field }) => (
            <MultiChips
              label={t('form.animalKind')}
              options={RESCUE_ANIMAL_KIND.map((value) => ({ value, label: tr(`kinds.${value}`) }))}
              value={field.value ? [field.value] : []}
              onChange={(v) => field.onChange(v[v.length - 1])}
            />
          )}
        />
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
        <FormTextField control={control} name="reference" label={t('form.reference')} />
        <FormTextField control={control} name="suspectInfo" label={t('form.suspectInfo')} hint={t('form.suspectHint')} multiline />
        <PhotoStrip picked={picked} max={MAX_CENTRAL_PHOTOS} onPick={(p) => setPicked((l) => [...l, p])} onRemovePicked={(i) => setPicked((l) => l.filter((_, idx) => idx !== i))} />
        <Controller
          control={control}
          name="anonymous"
          render={({ field }) => (
            <Checkbox checked={Boolean(field.value)} onChange={field.onChange} accessibilityLabel={t('form.anonymous')}>
              <AppText>{t('form.anonymous')}</AppText>
              <AppText variant="caption" color="textMuted">
                {t('form.anonymousHint')}
              </AppText>
            </Checkbox>
          )}
        />
        <AppText variant="caption" color="textMuted">
          {t('form.goodFaith')}
        </AppText>
      </View>

      <Button variant="danger" icon="send" label={t('form.submit')} loading={saving} onPress={submit} testID="report-submit" />
    </Screen>
  );
}
