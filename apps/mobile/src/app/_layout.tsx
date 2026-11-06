import * as Sentry from '@sentry/react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { initAnalytics, track } from '@/core/analytics';
import { initErrorReporting } from '@/core/errors/report';
import { connectEmulatorsIfEnabled } from '@/core/firebase';
import { initI18n, loadLanguagePreference } from '@/core/i18n';
import { ThemeProvider, type ThemePreference, loadThemePreference, useTheme } from '@/core/theme/ThemeProvider';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { configureGoogleSignIn } from '@/features/auth/auth.service';
import { NotificationBridge } from '@/features/reminders/NotificationBridge';
import { ReminderSync } from '@/features/reminders/ReminderSync';

SplashScreen.preventAutoHideAsync();
initErrorReporting();
initAnalytics();
configureGoogleSignIn();

export { ErrorBoundary } from 'expo-router';

function RootLayout() {
  const [boot, setBoot] = useState<{ theme: ThemePreference } | null>(null);

  useEffect(() => {
    (async () => {
      // Os emuladores (só em desenvolvimento) precisam estar ligados ANTES de qualquer uso de Auth/Firestore.
      // A função nunca lança erro; mesmo assim, qualquer imprevisto aqui não pode deixar a tela parada.
      try {
        await connectEmulatorsIfEnabled();
      } catch (error) {
        console.warn('[firebase] falha ao preparar os emuladores:', (error as Error)?.message ?? error);
      }
      // Idioma e tema são lidos ANTES da primeira tela, para não "piscar" na aparência errada.
      const [language, theme] = await Promise.all([loadLanguagePreference(), loadThemePreference()]);
      await initI18n(language);
      setBoot({ theme });
      track({ name: 'app_opened' });
    })().catch((error) => {
      // Último recurso: abre o app com os padrões em vez de ficar parado na abertura.
      console.warn('[boot] falha na preparação inicial; abrindo com os padrões:', (error as Error)?.message ?? error);
      void initI18n('system')
        .catch(() => undefined)
        .finally(() => setBoot({ theme: 'system' }));
    });
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
  const { t: tr } = useTranslation('rga');
  const { t: tm } = useTranslation('meds');
  const { t: tsa } = useTranslation('health');
  const { t: tn } = useTranslation('nearby');
  const reducedMotion = useReducedMotion();
  const { t: trs } = useTranslation('rescue');
  const { t: trp } = useTranslation('report');
  const { t: tad } = useTranslation('adoption');

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
      {/* Lembretes de dose: só para quem tem conta (cadastro) e está logado. */}
      {signedIn && user && !user.isAnonymous ? (
        <>
          <ReminderSync />
          <NotificationBridge />
        </>
      ) : null}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
          // Transições NATIVAS da plataforma (nunca refeitas em JS). Com "reduzir movimento": só esmaecer.
          ...(reducedMotion ? { animation: 'fade' as const } : {}),
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
          <Stack.Screen name="pet/import-rga" options={{ title: tr('title') }} />
          <Stack.Screen name="pet/[id]/import-rga" options={{ title: tr('titleUpdate') }} />
          <Stack.Screen name="pet/[id]/medications/index" options={{ title: tm('title') }} />
          {/* "Registrar medicação": tarefa curta e independente -> abre como modal, subindo de baixo (nativo). */}
          <Stack.Screen
            name="pet/[id]/medications/new"
            options={{ title: tm('form.newTitle'), presentation: 'modal', animation: reducedMotion ? 'fade' : 'slide_from_bottom' }}
          />
          <Stack.Screen name="pet/[id]/medications/[medId]/index" options={{ title: tm('detail.title') }} />
          <Stack.Screen name="pet/[id]/medications/[medId]/edit" options={{ title: tm('form.editTitle') }} />
          <Stack.Screen name="pet/[id]/medications/scan" options={{ title: tm('scan.title') }} />
          <Stack.Screen name="pet/[id]/health/index" options={{ title: tsa('title') }} />
          <Stack.Screen name="pet/[id]/health/vaccine/new" options={{ title: tsa('vaccine.newTitle') }} />
          <Stack.Screen name="pet/[id]/health/vaccine/[vid]/index" options={{ title: tsa('vaccine.detailTitle') }} />
          <Stack.Screen name="pet/[id]/health/vaccine/[vid]/edit" options={{ title: tsa('vaccine.editTitle') }} />
          <Stack.Screen name="pet/[id]/health/event/new" options={{ title: tsa('event.newTitle') }} />
          <Stack.Screen name="pet/[id]/health/event/[eid]/index" options={{ title: tsa('event.detailTitle') }} />
          <Stack.Screen name="pet/[id]/health/event/[eid]/edit" options={{ title: tsa('event.editTitle') }} />
          <Stack.Screen name="nearby/suggest" options={{ title: tn('suggest.cta') }} />
          <Stack.Screen name="rescue/index" options={{ title: th('rescue.title') }} />
          <Stack.Screen name="rescue/guide" options={{ title: trs('guideTitle') }} />
          <Stack.Screen name="rescue/new" options={{ title: trs('form.title') }} />
          <Stack.Screen name="rescue/[id]" options={{ title: trs('title') }} />
          <Stack.Screen name="report/index" options={{ title: th('report.title') }} />
          <Stack.Screen name="report/new" options={{ title: trp('form.title'), presentation: 'modal' }} />
          <Stack.Screen name="report/[id]" options={{ title: trp('title') }} />
          <Stack.Screen name="adoption/index" options={{ title: tad('title') }} />
          <Stack.Screen name="adoption/new" options={{ title: tad('form.newTitle'), presentation: 'modal' }} />
          <Stack.Screen name="adoption/[id]/index" options={{ title: tad('title') }} />
          <Stack.Screen name="adoption/[id]/edit" options={{ title: tad('form.editTitle') }} />
          <Stack.Screen name="account/delete" options={{ title: tc('delete.title') }} />
        </Stack.Protected>

        <Stack.Screen name="legal/terms" options={{ title: tl('terms.title') }} />
        <Stack.Screen name="legal/privacy" options={{ title: tl('privacy.title') }} />
        <Stack.Screen name="+not-found" options={{ title: t('appName') }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
