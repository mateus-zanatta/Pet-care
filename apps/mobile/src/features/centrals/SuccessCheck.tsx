import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';
import { DURATION, EASE_OUT } from '@/components/motion/motion';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

/**
 * Confirmação de envio (momento RARO: aqui cabe um pouco de "delight"). Entra de 0.92 -> 1 com mola sem quicar
 * e esmaecendo; nunca de escala 0. Com "reduzir movimento": só esmaece.
 */
function successEntering() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: DURATION.enter, easing: EASE_OUT }),
      transform: [{ scale: withSpring(1, { duration: 400, dampingRatio: 1 }) }],
    },
  };
}

export function SuccessCheck({ title, body }: { title: string; body: string }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? FadeIn.duration(DURATION.state) : successEntering} accessibilityLiveRegion="polite">
      <Card tone="primary">
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Icon name="checkmark-circle" size={44} color="onPrimaryContainer" />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="heading" color="onPrimaryContainer">
              {title}
            </AppText>
            <AppText color="onPrimaryContainer">{body}</AppText>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}
