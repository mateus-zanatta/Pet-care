import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTheme } from '@/core/theme/ThemeProvider';
import type { ColorTokens } from '@/core/theme/tokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Ícone decorativo: o significado vem sempre do texto ao lado (invisível ao leitor de tela). */
export function Icon({ name, size = 24, color = 'text' }: { name: IconName; size?: number; color?: keyof ColorTokens }) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={colors[color]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
