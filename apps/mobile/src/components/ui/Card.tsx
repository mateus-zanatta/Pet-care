import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
import { useTheme } from '@/core/theme/ThemeProvider';
import { MIN_TOUCH } from '@/core/theme/tokens';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  tone?: 'surface' | 'alt' | 'primary' | 'accent';
  style?: ViewStyle;
  testID?: string;
};

export function Card({ children, onPress, accessibilityLabel, accessibilityHint, tone = 'surface', style, testID }: Props) {
  const { colors, radius, spacing } = useTheme();
  const background =
    tone === 'primary' ? colors.primaryContainer : tone === 'accent' ? colors.accentContainer : tone === 'alt' ? colors.surfaceAlt : colors.surface;
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
    <PressableScale
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      pressedScale={0.98}
      style={[styles.card, base, { minHeight: MIN_TOUCH }]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({ card: { borderWidth: StyleSheet.hairlineWidth } });
