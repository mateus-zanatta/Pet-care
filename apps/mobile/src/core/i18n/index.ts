/* eslint-disable import/no-named-as-default-member -- API padrão do i18next (i18n.use / i18n.changeLanguage) */
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getPref, setPref } from '../storage/prefs';
import {
  type LanguagePreference,
  parseLanguagePreference,
  resolveLocale,
} from './language';
import { DEFAULT_LOCALE, NAMESPACES, resources } from './resources';

export { type LanguagePreference } from './language';

function deviceLanguageCodes(): string[] {
  return getLocales().map((l) => l.languageCode ?? '');
}

export async function loadLanguagePreference(): Promise<LanguagePreference> {
  return parseLanguagePreference(await getPref('language'));
}

/** Inicializa o i18n uma única vez, já no idioma certo (evita "piscar" em outro idioma). */
export async function initI18n(preference: LanguagePreference): Promise<void> {
  if (i18n.isInitialized) return;
  await i18n.use(initReactI18next).init({
    resources,
    lng: resolveLocale(preference, deviceLanguageCodes()),
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    ns: NAMESPACES as string[],
    interpolation: { escapeValue: false }, // React já escapa
    returnNull: false,
  });
}

export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  await setPref('language', preference);
  await i18n.changeLanguage(resolveLocale(preference, deviceLanguageCodes()));
}

export { i18n };
