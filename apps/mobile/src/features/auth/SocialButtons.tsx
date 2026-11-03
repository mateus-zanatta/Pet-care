import React from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { track } from '@/core/analytics';
import { useAuth } from './AuthProvider';
import { signInWithApple, signInWithGoogle } from './auth.service';
import type { useAuthAction } from './useAuthAction';

type Props = { action: ReturnType<typeof useAuthAction>; mode: 'sign_in' | 'sign_up' };

/** Entrar com Google (todas as plataformas) e Apple (iOS — exigido pela App Store). */
export function SocialButtons({ action, mode }: Props) {
  const { t } = useTranslation('auth');
  const { refresh } = useAuth();
  const event = (method: 'google' | 'apple') => {
    refresh(); // garante que uma sessão "sem cadastro" vinculada passe a valer como conta
    track(mode === 'sign_up' ? { name: 'sign_up', method } : { name: 'sign_in', method });
  };

  return (
    <View style={{ gap: 12 }}>
      <AppText color="textMuted" align="center">
        {t('login.orWith')}
      </AppText>
      <Button
        variant="secondary"
        icon="logo-google"
        label={t('login.google')}
        disabled={action.busy}
        onPress={() => void action.run('auth.google', async () => { await signInWithGoogle(); event('google'); })}
      />
      {Platform.OS === 'ios' ? (
        <Button
          variant="secondary"
          icon="logo-apple"
          label={t('login.apple')}
          disabled={action.busy}
          onPress={() => void action.run('auth.apple', async () => { await signInWithApple(); event('apple'); })}
        />
      ) : null}
    </View>
  );
}
