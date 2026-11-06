import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useEnterAnimation } from './motion';

/** Bloco que entra de baixo, em cascata pelo `index` (com "reduzir movimento": só esmaece). Só na montagem. */
export function EnterView({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const entering = useEnterAnimation(index);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
