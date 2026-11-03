import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MIN_TOUCH } from '@/core/theme/tokens';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  tone?: 'surface' | 'alt' | 'primary';
  style?: ViewStyle;
  testID?: string;
};

export function Card({ children, onPress, accessibilityLabel, accessibilityHint, tone = 'surface', style, testID }: Props) {
  const { colors, radius, spacing } = useTheme();
  const background = tone === 'primary' ? colors.primaryContainer : tone === 'alt' ? colors.surfaceAlt : colors.surface;
  const base: ViewStyle = {
    backgroundColor: background,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...style,
  };

  if (!onPress) {
    return (
      <View style={[styles.card, base]} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.card, base, { minHeight: MIN_TOUCH, opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({ card: { borderWidth: StyleSheet.hairlineWidth } });
