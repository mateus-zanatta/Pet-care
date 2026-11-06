import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { useEnterAnimation } from './motion';

function Entering() {
  const entering = useEnterAnimation(2);
  return (
    <Animated.View entering={entering}>
      <Text>entrou</Text>
    </Animated.View>
  );
}

describe('movimento', () => {
  it('PressableScale chama onPress e continua acessível como botão', async () => {
    const onPress = jest.fn();
    await render(
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Salvar">
        <Text>Salvar</Text>
      </PressableScale>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a animação de entrada não esconde o conteúdo', async () => {
    await render(<Entering />);
    expect(screen.getByText('entrou')).toBeTruthy();
  });
});

/**
 * Regressão: os testes rodam a versão "web" do Reanimated, que aceita a string "cubic-bezier(...)". No CELULAR ela
 * derruba o app ("Invalid predefined timing function"). Aqui usamos a MESMA validação que roda no aparelho.
 */
describe('curvas aceitas pelo Reanimated no celular', () => {
  const { normalizeTimingFunction } = require('react-native-reanimated/src/css/native/normalization/common/settings') as {
    normalizeTimingFunction: (fn: unknown) => unknown;
  };
  const motion = require('./motion') as Record<string, unknown>;

  it.each(['CSS_EASE_OUT', 'CSS_EASE_IN_OUT'])('%s passa na validação nativa', (name) => {
    expect(() => normalizeTimingFunction(motion[name])).not.toThrow();
  });

  it('a string no formato web seria recusada (é isso que o teste protege)', () => {
    expect(() => normalizeTimingFunction('cubic-bezier(0.23, 1, 0.32, 1)')).toThrow(/Invalid predefined timing function/);
  });
});
