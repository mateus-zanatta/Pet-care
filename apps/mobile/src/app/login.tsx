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

  const submit = handleSubmit((values) =>
    action.run('auth.login', async () => {
      await signInWithEmail(values.email, values.password);
      track({ name: 'sign_in', method: 'password' });
    }),
  );

  return (
    <Screen keyboard>
      {action.errorKey ? <Banner tone="error">{te(action.errorKey)}</Banner> : null}
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
      <Button label={t('login.submit')} icon="log-in" loading={action.busy} onPress={submit} />
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
