/**
 * Design tokens. Paleta acolhedora: verde-azulado de confiança (primário) + terracota quente (acento,
 * para adoção e destaques) sobre fundos creme. Escalas geradas e auditadas (WCAG 2.1 e APCA) com a
 * ferramenta UI Color Palette; contraste mínimo WCAG AA (4.5:1) nos dois modos — conferido por contrast.test.ts.
 */
export type ColorTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  /** Acento quente (terracota): adoção, destaques e chamadas afetivas. Nunca para erro (isso é "danger"). */
  accent: string;
  onAccent: string;
  accentContainer: string;
  onAccentContainer: string;
  danger: string;
  onDanger: string;
  dangerContainer: string;
  onDangerContainer: string;
  warningContainer: string;
  onWarningContainer: string;
  success: string;
  overlay: string;
};

export const lightColors: ColorTokens = {
  background: '#FFFAF4',
  surface: '#FFFFFF',
  surfaceAlt: '#F6EEE4',
  border: '#D6CABD',
  text: '#1F2A27',
  textMuted: '#55615D',
  primary: '#0F6B5C',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D7F0E9',
  onPrimaryContainer: '#08392F',
  accent: '#B3543B',
  onAccent: '#FFFFFF',
  accentContainer: '#FFE3D3',
  onAccentContainer: '#610E00',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  dangerContainer: '#FBE3E0',
  onDangerContainer: '#5C100B',
  warningContainer: '#FFEBC7',
  onWarningContainer: '#4A3000',
  success: '#1B6E3C',
  overlay: 'rgba(0,0,0,0.45)',
};

export const darkColors: ColorTokens = {
  background: '#101615',
  surface: '#18211F',
  surfaceAlt: '#202C29',
  border: '#3A4A46',
  text: '#EDF3F1',
  textMuted: '#A9B8B3',
  primary: '#5FD0BB',
  onPrimary: '#06201B',
  primaryContainer: '#14463D',
  onPrimaryContainer: '#C9F2E8',
  accent: '#FFA289',
  onAccent: '#3A0D00',
  accentContainer: '#5A2414',
  onAccentContainer: '#FFDBC4',
  danger: '#FF8A80',
  onDanger: '#3B0A07',
  dangerContainer: '#5C1A15',
  onDangerContainer: '#FFDAD6',
  warningContainer: '#4A3A12',
  onWarningContainer: '#FFE7B0',
  success: '#7DD99D',
  overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Alvo de toque mínimo recomendado (Android 48dp / iOS 44pt). */
export const MIN_TOUCH = 48;
/** Limite do aumento de fonte do sistema, para não quebrar layouts (ainda cresce bastante). */
export const MAX_FONT_SCALE = 1.6;

export const typography = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
};
export type TextVariant = keyof typeof typography;
