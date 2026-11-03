import { type AppLocale } from '@petcare/shared';
import { DEFAULT_LOCALE } from './resources';

export type LanguagePreference = 'system' | AppLocale;

/**
 * Escolhe o idioma do app. Preferência explícita vence; senão usa o primeiro idioma do
 * aparelho que o app suporta; se nenhum for suportado, português (padrão do produto).
 */
export function resolveLocale(
  preference: LanguagePreference,
  deviceLanguageCodes: readonly (string | null | undefined)[],
): AppLocale {
  if (preference !== 'system') return preference;
  for (const code of deviceLanguageCodes) {
    const language = code?.toLowerCase().split(/[-_]/)[0];
    if (language === 'pt') return 'pt-BR';
    if (language === 'en') return 'en';
  }
  return DEFAULT_LOCALE;
}

export function parseLanguagePreference(value: string | null): LanguagePreference {
  return value === 'pt-BR' || value === 'en' ? value : 'system';
}
