import * as Sentry from '@sentry/react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initAnalytics, track } from '@/core/analytics';
import { initErrorReporting } from '@/core/errors/report';
import { connectEmulatorsIfEnabled } from '@/core/firebase';
import { initI18n, loadLanguagePreference } from '@/core/i18n';
import { ThemeProvider, type ThemePreference, loadThemePreference, useTheme } from '@/core/theme/ThemeProvider';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { configureGoogleSignIn } from '@/features/auth/auth.service';

SplashScreen.preventAutoHideAsync();
initErrorReporting();
initAnalytics();
connectEmulatorsIfEnabled();
configureGoogleSignIn();

export { ErrorBoundary } from 'expo-router';

function RootLayout() {
  const [boot, setBoot] = useState<{ theme: ThemePreference } | null>(null);

  useEffect(() => {
    (async () => {
      // Idioma e tema são lidos ANTES da primeira tela, para não "piscar" na aparência errada.
      const [language, theme] = await Promise.all([loadLanguagePreference(), loadThemePreference()]);
      await initI18n(language);
      setBoot({ theme });
      track({ name: 'app_opened' });
    })();
  }, []);

  if (!boot) return null; // a tela de abertura continua visível

  return (
    <ThemeProvider initialPreference={boot.theme}>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);

function Navigation() {
  const { status, user } = useAuth();
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const { t: ta } = useTranslation('auth');
  const { t: th } = useTranslation('home');
  const { t: tp } = useTranslation('pets');
  const { t: tc } = useTranslation('account');
  const { t: tl } = useTranslation('legal');

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  const signedIn = status === 'signedIn';
  // Quem está "sem cadastro" também pode abrir login/cadastro (para criar conta sem perder dados).
  const canOpenAuthForms = !signedIn || Boolean(user?.isAnonymous);

  const base = DefaultTheme;
  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : base),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : base).colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={canOpenAuthForms}>
          <Stack.Screen name="login" options={{ title: ta('login.title') }} />
          <Stack.Screen name="register" options={{ title: ta('register.title') }} />
          <Stack.Screen name="forgot-password" options={{ title: ta('forgot.title') }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="pet/new" options={{ title: tp('newTitle') }} />
          <Stack.Screen name="pet/[id]/index" options={{ title: tp('detailTitle') }} />
          <Stack.Screen name="pet/[id]/edit" options={{ title: tp('editTitle') }} />
          <Stack.Screen name="rescue/index" options={{ title: th('rescue.title') }} />
          <Stack.Screen name="report/index" options={{ title: th('report.title') }} />
          <Stack.Screen name="account/delete" options={{ title: tc('delete.title') }} />
        </Stack.Protected>

        <Stack.Screen name="legal/terms" options={{ title: tl('terms.title') }} />
        <Stack.Screen name="legal/privacy" options={{ title: tl('privacy.title') }} />
        <Stack.Screen name="+not-found" options={{ title: t('appName') }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
