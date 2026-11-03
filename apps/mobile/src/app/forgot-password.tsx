import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { sendPasswordReset } from '@/features/auth/auth.service';
import { type ForgotValues, forgotSchema } from '@/features/auth/schemas';
import { useAuthAction } from '@/features/auth/useAuthAction';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const action = useAuthAction();
  const [sent, setSent] = useState(false);
  const { control, handleSubmit } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async (values) => {
    // Mesmo se o e-mail não existir, mostramos o mesmo aviso (não revela quem tem conta).
    const ok = await action.run('auth.forgot', async () => {
      try {
        await sendPasswordReset(values.email);
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      }
    });
    if (ok) setSent(true);
  });

  return (
    <Screen keyboard>
      <AppText>{t('forgot.intro')}</AppText>
      {action.errorKey ? <Banner tone="error">{te(action.errorKey)}</Banner> : null}
      {sent ? <Banner tone="info">{t('forgot.sent')}</Banner> : null}
      <FormTextField
        control={control}
        name="email"
        label={t('forgot.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        onSubmitEditing={() => void submit()}
      />
      <Button label={t('forgot.submit')} icon="mail" loading={action.busy} onPress={submit} />
    </Screen>
  );
}
