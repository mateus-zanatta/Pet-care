import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MIN_TOUCH } from '@/core/theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/** Botão grande (altura mínima 52), com estado de carregamento, rótulo para leitor de tela e resposta ao toque. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  accessibilityHint,
  testID,
}: Props) {
  const { colors, radius } = useTheme();
  const inactive = disabled || loading;

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
    danger: { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    accent: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
  }[variant];

  const fgToken =
    variant === 'primary' ? 'onPrimary' : variant === 'danger' ? 'onDanger' : variant === 'accent' ? 'onAccent' : 'primary';

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: radius.md,
          opacity: inactive ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : icon ? (
          <Icon name={icon} size={22} color={fgToken} />
        ) : null}
        <AppText variant="heading" align="center" style={{ color: palette.fg, flexShrink: 1 }} numberOfLines={2}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  // maxWidth + flexShrink no texto: rótulos longos quebram em 2 linhas em vez de serem cortados.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%' },
});
