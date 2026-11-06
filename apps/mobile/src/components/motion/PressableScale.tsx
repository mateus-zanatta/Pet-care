import React, { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { CSS_EASE_OUT, DURATION } from './motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  /** Estilo da parte visível (fundo, borda, raio...). */
  style?: StyleProp<ViewStyle>;
  /** Escala ao apertar: sutil (0.95–0.98). Cartões grandes usam menos (0.98). */
  pressedScale?: number;
};

/**
 * Tudo o que se aperta no app: encolhe 3% em 120 ms ASSIM que o dedo encosta (não depois de soltar) e volta ao
 * soltar. É uma transição de estilo do Reanimated (roda na thread de interface, sem renderizar a cada quadro).
 * Com "reduzir movimento": em vez de encolher, só fica um pouco mais transparente.
 */
export function PressableScale({ children, style, pressedScale = 0.97, disabled, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const active = pressed && !disabled;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: active && !reduced ? pressedScale : 1 }],
            opacity: active && reduced ? 0.8 : 1,
            transitionProperty: ['transform', 'opacity'],
            transitionDuration: DURATION.press,
            transitionTimingFunction: CSS_EASE_OUT,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
