import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'warning' | 'error';

const TONES: Record<Tone, { icon: IconName; bg: 'primaryContainer' | 'warningContainer' | 'dangerContainer'; fg: 'onPrimaryContainer' | 'onWarningContainer' | 'onDangerContainer' }> = {
  info: { icon: 'information-circle', bg: 'primaryContainer', fg: 'onPrimaryContainer' },
  warning: { icon: 'warning', bg: 'warningContainer', fg: 'onWarningContainer' },
  error: { icon: 'alert-circle', bg: 'dangerContainer', fg: 'onDangerContainer' },
};

/** Aviso em destaque. Erros usam role "alert" para o leitor de tela anunciar na hora. */
export function Banner({ tone = 'info', children }: { tone?: Tone; children: string }) {
  const { colors, radius, spacing } = useTheme();
  const t = TONES[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'none'}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors[t.bg],
        alignItems: 'flex-start',
      }}
    >
      <Icon name={t.icon} size={22} color={t.fg} />
      <AppText style={{ flex: 1, color: colors[t.fg] }}>{children}</AppText>
    </View>
  );
}
