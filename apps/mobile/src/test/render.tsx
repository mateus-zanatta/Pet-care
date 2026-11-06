import { APP_NAME } from '@petcare/shared';
import { type RenderOptions, render } from '@testing-library/react-native';
import i18n from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { NAMESPACES, resources } from '@/core/i18n/resources';
import { ThemeProvider } from '@/core/theme/ThemeProvider';

/** i18n de teste: mesmo conteúdo do app, sempre em português (ou no idioma pedido). */
export async function setupTestI18n(lng: 'pt-BR' | 'en' = 'pt-BR') {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'pt-BR',
      defaultNS: 'common',
      ns: NAMESPACES as string[],
      interpolation: { escapeValue: false, defaultVariables: { appName: APP_NAME } },
    });
  } else {
    await i18n.changeLanguage(lng);
  }
  return i18n;
}

export async function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider initialPreference="light">{ui}</ThemeProvider>
    </I18nextProvider>,
    options,
  );
}
