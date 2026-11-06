import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FormTextField, useErrorText } from '@/components/form/FormFields';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/core/analytics';
import { useAuth } from '@/features/auth/AuthProvider';
import { registerWithEmail } from '@/features/auth/auth.service';
import { LegalLinks } from '@/features/auth/LegalLinks';
import { PasswordStrength } from '@/features/auth/PasswordStrength';
import { type RegisterValues, registerSchema } from '@/features/auth/schemas';
import { SocialButtons } from '@/features/auth/SocialButtons';
import { useAuthAction } from '@/features/auth/useAuthAction';

export default function RegisterScreen() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const errorText = useErrorText();
  const router = useRouter();
  const { refresh } = useAuth();
  const action = useAuthAction();
  const { control, handleSubmit } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false },
  });

  const [password, email, name] = useWatch({ control, name: ['password', 'email', 'name'] });

  const submit = handleSubmit((values) =>
    action.run('auth.register', async () => {
      await registerWithEmail(values);
      refresh(); // o nome foi gravado depois do login
      track({ name: 'sign_up', method: 'password' });
    }),
  );

  return (
    <Screen keyboard>
      {action.errorKey ? <Banner tone="error">{te(action.errorKey)}</Banner> : null}
      <FormTextField control={control} name="name" label={t('register.name')} autoCapitalize="words" autoComplete="name" />
      <FormTextField
        control={control}
        name="email"
        label={t('register.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        label={t('register.password')}
        hint={t('register.passwordHint')}
        secureTextEntry
        secureToggleLabels={{ show: t('showPassword'), hide: t('hidePassword') }}
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <PasswordStrength password={password ?? ''} email={email} name={name} />
      <Controller
        control={control}
        name="acceptTerms"
        render={({ field, fieldState }) => (
          <Checkbox
            checked={field.value}
            onChange={field.onChange}
            accessibilityLabel={t('register.acceptTerms').replace(/<\/?[a-z]+>/g, '')}
            error={errorText(fieldState.error?.message)}
          >
            <LegalLinks i18nKey="register.acceptTerms" variant="body" />
          </Checkbox>
        )}
      />
      <Button label={t('register.submit')} icon="person-add" loading={action.busy} onPress={submit} />
      <SocialButtons action={action} mode="sign_up" />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <AppText color="textMuted">{t('register.haveAccount')}</AppText>
        <Button variant="ghost" label={t('register.signInInstead')} onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}
