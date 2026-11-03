import React from 'react';
import { type Control, type FieldValues, type Path } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FormTextField } from '@/components/form/FormFields';

/** Veterinário(a) + CRMV (número e UF) + local. Os campos do formulário precisam se chamar vetName, crmvNumber, crmvUf e clinic. */
export function VetFields<T extends FieldValues>({ control }: { control: Control<T> }) {
  const { t } = useTranslation('health');
  const { t: tc } = useTranslation();
  const name = (field: string) => field as Path<T>;
  return (
    <>
      <FormTextField control={control} name={name('vetName')} label={t('form.vetName')} optional={tc('optional')} autoCapitalize="words" maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 3 }}>
          <FormTextField control={control} name={name('crmvNumber')} label={t('form.crmvNumber')} optional={tc('optional')} keyboardType="number-pad" maxLength={8} />
        </View>
        <View style={{ flex: 1 }}>
          <FormTextField control={control} name={name('crmvUf')} label={t('form.crmvUf')} autoCapitalize="characters" autoCorrect={false} maxLength={2} />
        </View>
      </View>
      <FormTextField control={control} name={name('clinic')} label={t('form.clinic')} optional={tc('optional')} maxLength={120} />
    </>
  );
}
