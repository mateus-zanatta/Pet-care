import { useRouter } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/core/theme/ThemeProvider';

function LinkText({ onPress, children }: { onPress: () => void; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="link"
      style={{ color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' }}
    >
      {children}
    </Text>
  );
}

/** Frase com links para Termos e Privacidade. `i18nKey` aponta para um texto com <terms> e <privacy>. */
export function LegalLinks({ i18nKey, variant = 'caption' }: { i18nKey: 'legalNotice' | 'register.acceptTerms'; variant?: 'caption' | 'body' }) {
  const router = useRouter();
  const { t } = useTranslation('auth');
  return (
    <AppText variant={variant} color="textMuted">
      <Trans
        t={t}
        i18nKey={i18nKey}
        components={{
          terms: <LinkText onPress={() => router.push('/legal/terms')} />,
          privacy: <LinkText onPress={() => router.push('/legal/privacy')} />,
        }}
      />
    </AppText>
  );
}
