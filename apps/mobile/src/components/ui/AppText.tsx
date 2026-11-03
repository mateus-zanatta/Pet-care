import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { type ColorTokens, MAX_FONT_SCALE, type TextVariant, typography } from '@/core/theme/tokens';

type Props = TextProps & {
  variant?: TextVariant;
  color?: keyof ColorTokens;
  align?: 'left' | 'center' | 'right';
};

/** Texto padrão do app: respeita o tamanho de fonte do sistema (até um limite) e o tema. */
export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      accessibilityRole={variant === 'title' || variant === 'display' ? 'header' : undefined}
      style={[typography[variant], { color: colors[color], textAlign: align }, style]}
      {...rest}
    />
  );
}
