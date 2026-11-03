import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { deleteMyAccount } from '@/features/account/deleteAccount';
import { useUser } from '@/features/auth/AuthProvider';
import { reauthenticate } from '@/features/auth/auth.service';
import { isCancelled, mapAuthError } from '@/features/auth/errors';

export default function DeleteAccountScreen() {
  const { t } = useTranslation('account');
  const { t: ta } = useTranslation('auth');
  const { t: te } = useTranslation('errors');
  const { t: tc } = useTranslation();
  const user = useUser();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      let appleAuthorizationCode: string | null = null;
      if (user.provider === 'password') {
        await reauthenticate({ type: 'password', password });
      } else if (user.provider === 'google.com') {
        await reauthenticate({ type: 'google' });
      } else if (user.provider === 'apple.com') {
        appleAuthorizationCode = (await reauthenticate({ type: 'apple' })).appleAuthorizationCode;
      }
      await deleteMyAccount({ appleAuthorizationCode });
      track({ name: 'account_deleted' });
      // O app volta sozinho para a tela inicial, pois a sessão acabou.
    } catch (e) {
      if (isCancelled(e)) {
        setBusy(false);
        return;
      }
      reportError('account.delete', e);
      const key = mapAuthError(e);
      setError(key === 'auth.invalidCredentials' ? te('account.wrongPassword') : key === 'generic' ? te('account.deleteFailed') : te(key));
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert(t('delete.confirmTitle'), t('delete.confirmBody'), [
      { text: tc('actions.cancel'), style: 'cancel' },
      { text: tc('actions.delete'), style: 'destructive', onPress: () => void run() },
    ]);

  const needsPassword = user.provider === 'password';
  const label = busy
    ? t('delete.deleting')
    : user.provider === 'google.com'
      ? t('delete.confirmWithGoogle')
      : user.provider === 'apple.com'
        ? t('delete.confirmWithApple')
        : needsPassword
          ? t('delete.confirmWithPassword')
          : t('delete.confirmAnonymous');

  return (
    <Screen keyboard>
      <AppText>{t('delete.intro')}</AppText>
      <View style={{ gap: 6 }}>
        {(['profile', 'pets', 'own', 'login'] as const).map((item) => (
          <AppText key={item}>{`• ${t(`delete.items.${item}`)}`}</AppText>
        ))}
      </View>
      <AppText color="textMuted">{t('delete.sharedNote')}</AppText>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {needsPassword ? (
        <TextField
          label={ta('login.password')}
          hint={t('delete.confirmPassword')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          secureToggleLabels={{ show: ta('showPassword'), hide: ta('hidePassword') }}
          autoCapitalize="none"
          autoComplete="current-password"
        />
      ) : null}
      <Button
        variant="danger"
        icon="trash"
        label={label}
        loading={busy}
        disabled={needsPassword && password.length === 0}
        onPress={confirm}
      />
    </Screen>
  );
}
