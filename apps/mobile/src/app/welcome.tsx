import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { track } from '@/core/analytics';
import { signInAnonymouslyNow } from '@/features/auth/auth.service';
import { LegalLinks } from '@/features/auth/LegalLinks';
import { useAuthAction } from '@/features/auth/useAuthAction';

export default function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const { t: tc } = useTranslation();
  const router = useRouter();
  const action = useAuthAction();

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingVertical: 32 }}>
        <Icon name="paw" size={72} color="primary" />
        <AppText variant="display" align="center">
          {tc('appName')}
        </AppText>
        <AppText variant="heading" align="center">
          {t('welcome.title')}
        </AppText>
        <AppText color="textMuted" align="center">
          {t('welcome.subtitle')}
        </AppText>
      </View>

      <View style={{ gap: 12 }}>
        {action.errorKey ? <Banner tone="error">{te(action.errorKey)}</Banner> : null}
        <Button label={t('welcome.signIn')} icon="log-in" onPress={() => router.push('/login')} disabled={action.busy} />
        <Button
          variant="secondary"
          label={t('welcome.continueAnonymous')}
          loading={action.busy}
          onPress={() =>
            void action.run('auth.anonymous', async () => {
              await signInAnonymouslyNow();
              track({ name: 'sign_in', method: 'anonymous' });
            })
          }
        />
        <AppText variant="caption" color="textMuted" align="center">
          {t('welcome.anonymousNote')}
        </AppText>
        <LegalLinks i18nKey="legalNotice" />
      </View>
    </Screen>
  );
}
