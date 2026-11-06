import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FormTextField } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/core/analytics';
import { signInWithEmail } from '@/features/auth/auth.service';
import { mapAuthError } from '@/features/auth/errors';
import { clearLoginFailures, loginWaitMs, registerLoginFailure } from '@/features/auth/loginGuard';
import { useLoginWait } from '@/features/auth/useLoginWait';
import { LegalLinks } from '@/features/auth/LegalLinks';
import { type LoginValues, loginSchema } from '@/features/auth/schemas';
import { SocialButtons } from '@/features/auth/SocialButtons';
import { useAuthAction } from '@/features/auth/useAuthAction';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const router = useRouter();
  const action = useAuthAction();
  const { control, handleSubmit } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Espera crescente depois de erros seguidos (2 s, 4 s, 8 s... até 15 min). Veja features/auth/loginGuard.ts.
  const wait = useLoginWait();
  const waitSeconds = wait.seconds;

  const submit = handleSubmit(async (values) => {
    const remaining = await loginWaitMs(values.email);
    if (remaining > 0) {
      wait.start(remaining);
      return;
    }
    await action.run('auth.login', async () => {
      try {
        await signInWithEmail(values.email, values.password);
      } catch (error) {
        if (mapAuthError(error) === 'auth.invalidCredentials') {
          await registerLoginFailure(values.email);
          const next = await loginWaitMs(values.email);
          if (next > 0) wait.start(next);
        }
        throw error;
      }
      await clearLoginFailures(values.email);
      track({ name: 'sign_in', method: 'password' });
    });
  });

  return (
    <Screen keyboard>
      {action.errorKey ? <Banner tone="error">{te(action.errorKey)}</Banner> : null}
      {waitSeconds > 0 ? (
        <Banner tone="warning">
          {waitSeconds >= 60 ? t('login.waitMinutes', { minutes: Math.ceil(waitSeconds / 60) }) : t('login.wait', { seconds: waitSeconds })}
        </Banner>
      ) : null}
      <FormTextField
        control={control}
        name="email"
        label={t('login.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        label={t('login.password')}
        secureTextEntry
        secureToggleLabels={{ show: t('showPassword'), hide: t('hidePassword') }}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
      />
      <Button label={t('login.submit')} icon="log-in" loading={action.busy} disabled={waitSeconds > 0} onPress={submit} />
      <Button variant="ghost" label={t('login.forgot')} onPress={() => router.push('/forgot-password')} />
      <SocialButtons action={action} mode="sign_in" />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <AppText color="textMuted">{t('login.noAccount')}</AppText>
        <Button variant="ghost" label={t('login.createOne')} onPress={() => router.replace('/register')} />
      </View>
      <LegalLinks i18nKey="legalNotice" />
    </Screen>
  );
}
