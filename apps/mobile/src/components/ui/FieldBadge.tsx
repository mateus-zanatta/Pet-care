import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { AppText } from './AppText';

export type FieldBadgeInfo = { kind: 'rga' | 'check'; label: string };

/** Selo ao lado do rótulo de um campo: "lido do RG" (informativo) ou "confira" (atenção). */
export function FieldBadge({ kind, label }: FieldBadgeInfo) {
  const { colors, radius } = useTheme();
  const isCheck = kind === 'check';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: isCheck ? colors.warningContainer : colors.primaryContainer,
      }}
    >
      <AppText variant="caption" style={{ color: isCheck ? colors.onWarningContainer : colors.onPrimaryContainer, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}
