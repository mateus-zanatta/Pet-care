import { contrastRatio } from './contrast';
import { type ColorTokens, darkColors, lightColors } from './tokens';

const AA = 4.5;

const pairs: [string, keyof ColorTokens, keyof ColorTokens][] = [
  ['texto sobre fundo', 'text', 'background'],
  ['texto sobre cartão', 'text', 'surface'],
  ['texto sobre cartão alternativo', 'text', 'surfaceAlt'],
  ['texto secundário sobre fundo', 'textMuted', 'background'],
  ['texto secundário sobre cartão', 'textMuted', 'surface'],
  ['texto secundário sobre cartão alternativo', 'textMuted', 'surfaceAlt'],
  ['botão primário', 'onPrimary', 'primary'],
  ['link/primário sobre fundo', 'primary', 'background'],
  ['link/primário sobre cartão', 'primary', 'surface'],
  ['texto no container primário', 'onPrimaryContainer', 'primaryContainer'],
  ['botão de perigo', 'onDanger', 'danger'],
  ['perigo como texto sobre fundo', 'danger', 'background'],
  ['perigo como texto sobre cartão', 'danger', 'surface'],
  ['texto no container de perigo', 'onDangerContainer', 'dangerContainer'],
  ['texto no container de aviso', 'onWarningContainer', 'warningContainer'],
  ['sucesso sobre cartão', 'success', 'surface'],
];

describe.each([
  ['claro', lightColors],
  ['escuro', darkColors],
])('contraste WCAG AA — modo %s', (_mode, colors) => {
  it.each(pairs)('%s', (_name, fg, bg) => {
    const ratio = contrastRatio(colors[fg], colors[bg]);
    expect(ratio).toBeGreaterThanOrEqual(AA);
  });
});
