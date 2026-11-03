import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { ThemeProvider } from '@/core/theme/ThemeProvider';
import { Button } from './Button';
import { Checkbox } from './Checkbox';

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));

describe('layout dos componentes (proteção contra texto cortado ou invisível)', () => {
  it('Checkbox ocupa a largura toda mesmo dentro de um contêiner centralizado (senão o texto some)', async () => {
    await render(
      <ThemeProvider initialPreference="light">
        <Checkbox checked onChange={() => undefined} accessibilityLabel="Usar a foto do RG">
          <Text>Usar a foto do RG como foto de perfil</Text>
        </Checkbox>
      </ThemeProvider>,
    );
    const label = screen.getByText('Usar a foto do RG como foto de perfil');
    // Sobe até a raiz do Checkbox e confere o alinhamento.
    let node = label.parent;
    let stretched = false;
    while (node) {
      if (flat(node.props?.style).alignSelf === 'stretch') stretched = true;
      node = node.parent;
    }
    expect(stretched).toBe(true);
  });

  it('Button deixa rótulos longos quebrarem em linhas em vez de cortar', async () => {
    await render(
      <ThemeProvider initialPreference="light">
        <Button label="Validar no SinPatinhas" icon="shield-checkmark" onPress={() => undefined} />
      </ThemeProvider>,
    );
    const text = screen.getByText('Validar no SinPatinhas');
    const style = flat(text.props.style);
    expect(style.flexShrink).toBe(1);
    expect(text.props.numberOfLines).toBe(2);
  });
});
