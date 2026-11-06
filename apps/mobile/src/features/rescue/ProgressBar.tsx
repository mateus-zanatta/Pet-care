import React, { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CSS_EASE_IN_OUT } from '@/components/motion/motion';
import { useTheme } from '@/core/theme/ThemeProvider';

/**
 * Barra de progresso. O preenchimento é absoluto e SEM filhos: animar a largura não força recalcular o layout de
 * mais ninguém (e mantém o canto arredondado, que `scaleX` deformaria). Transição de 250 ms, ease-in-out (move na tela).
 */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const { colors, radius } = useTheme();
  const [width, setWidth] = useState(0);
  const clamped = Math.min(Math.max(value, 0), 1);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: width * clamped,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
          transitionProperty: 'width',
          transitionDuration: 250,
          transitionTimingFunction: CSS_EASE_IN_OUT,
        }}
      />
    </View>
  );
}
