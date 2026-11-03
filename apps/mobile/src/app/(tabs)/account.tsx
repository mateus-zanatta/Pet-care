import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { InfoRow } from '@/components/ui/InfoRow';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/core/analytics';
import { type LanguagePreference, loadLanguagePreference, setLanguagePreference } from '@/core/i18n';
import { type ThemePreference, useTheme } from '@/core/theme/ThemeProvider';
import { useUser } from '@/features/auth/AuthProvider';
import { signOut } from '@/features/auth/auth.service';
import { reportError } from '@/core/errors/report';
import { isUsingEmulators } from '@/core/firebase';
import { Banner } from '@/components/ui/Banner';

export default function AccountScreen() {
  const { t } = useTranslation('account');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const user = useUser();
  const { preference, setPreference } = useTheme();
  const [language, setLanguage] = React.useState<LanguagePreference>('system');

  React.useEffect(() => {
    void loadLanguagePreference().then(setLanguage);
  }, []);

  const confirmSignOut = () =>
    Alert.alert(
      t('signOutConfirmTitle'),
      user.isAnonymous ? t('signOutAnonymousBody') : t('signOutConfirmBody'),
      [
        { text: tc('actions.cancel'), style: 'cancel' },
        {
          text: t('signOut'),
          style: 'destructive',
          onPress: () => {
            signOut()
              .then(() => track({ name: 'sign_out' }))
              .catch((e) => reportError('auth.signOut', e));
          },
        },
      ],
    );

  const languageOptions = [
    { value: 'system' as const, label: t('language.system') },
    { value: 'pt-BR' as const, label: t('language.ptBR') },
    { value: 'en' as const, label: t('language.en') },
  ];
  const themeOptions = [
    { value: 'system' as const, label: t('theme.system') },
    { value: 'light' as const, label: t('theme.light') },
    { value: 'dark' as const, label: t('theme.dark') },
  ];

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{t('title')}</AppText>

      {isUsingEmulators() ? <Banner tone="warning">{t('devEmulators')}</Banner> : null}

      {user.isAnonymous ? (
        <Card tone="primary">
          <View style={{ gap: 12 }}>
            <AppText variant="heading" color="onPrimaryContainer">
              {t('anonymous.title')}
            </AppText>
            <AppText color="onPrimaryContainer">{t('anonymous.body')}</AppText>
            <Button label={t('anonymous.create')} icon="person-add" onPress={() => router.push('/register')} />
            <Button variant="secondary" label={t('anonymous.signIn')} onPress={() => router.push('/login')} />
          </View>
        </Card>
      ) : (
        <Card>
          <View style={{ gap: 12 }}>
            {user.displayName ? <InfoRow label={t('profile.name')} value={user.displayName} /> : null}
            {user.email ? <InfoRow label={t('profile.email')} value={user.email} /> : null}
            <InfoRow label={t('profile.provider')} value={t(`profile.providers.${user.provider}`)} />
          </View>
        </Card>
      )}

      <ChoiceChips
        label={t('language.title')}
        options={languageOptions}
        value={language}
        onChange={(value) => {
          setLanguage(value);
          void setLanguagePreference(value);
        }}
      />
      <ChoiceChips
        label={t('theme.title')}
        options={themeOptions}
        value={preference}
        onChange={(value: ThemePreference) => setPreference(value)}
      />

      <View style={{ gap: 8 }}>
        <AppText variant="heading">{t('about.title')}</AppText>
        <Button variant="secondary" icon="document-text" label={t('about.terms')} onPress={() => router.push('/legal/terms')} />
        <Button variant="secondary" icon="lock-closed" label={t('about.privacy')} onPress={() => router.push('/legal/privacy')} />
        <AppText variant="caption" color="textMuted">
          {t('about.disclaimer')}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {t('about.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </AppText>
      </View>

      <View style={{ gap: 8 }}>
        <Button variant="secondary" icon="log-out" label={t('signOut')} onPress={confirmSignOut} />
        <Button variant="ghost" label={t('delete.entry')} onPress={() => router.push('/account/delete')} />
      </View>
    </Screen>
  );
}
