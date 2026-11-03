import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuração do app. Valores que dependem de VOCÊ vêm de variáveis de ambiente
 * (veja .env.example e docs/SETUP.md) — nada secreto fica no repositório.
 */
const DEFAULT_IDENTIFIER = 'com.example.petcare';
const IDENTIFIER = process.env.APP_IDENTIFIER ?? DEFAULT_IDENTIFIER;

// Impede gerar um build "de verdade" com o identificador provisório.
if (process.env.EAS_BUILD && IDENTIFIER === DEFAULT_IDENTIFIER) {
  throw new Error(
    'Defina APP_IDENTIFIER (ex.: br.com.seunome.petcare) antes de gerar o build no EAS. ' +
      'O identificador não pode mudar depois de publicado.',
  );
}

/** Caminho de um arquivo opcional: variável de ambiente (EAS file secret) ou caminho local. */
function existingFile(envVar: string, localFallback: string): string | undefined {
  const candidate = process.env[envVar] ?? localFallback;
  return fs.existsSync(path.resolve(__dirname, candidate)) ? candidate : undefined;
}

const googleServicesAndroid = existingFile('GOOGLE_SERVICES_JSON', './firebase/google-services.json');
const googleServicesIos = existingFile('GOOGLE_SERVICES_PLIST', './firebase/GoogleService-Info.plist');

/** O esquema de URL do login Google no iOS é o REVERSED_CLIENT_ID do GoogleService-Info.plist. */
function googleIosUrlScheme(): string {
  if (process.env.GOOGLE_IOS_URL_SCHEME) return process.env.GOOGLE_IOS_URL_SCHEME;
  if (googleServicesIos) {
    const plist = fs.readFileSync(path.resolve(__dirname, googleServicesIos), 'utf8');
    const match = /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
    if (match?.[1]) return match[1];
  }
  return 'com.googleusercontent.apps.CONFIGURE-ME';
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Pet Care',
  slug: 'petcare',
  scheme: 'petcare',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  // Textos nativos (nome do app e pedidos de permissão) por idioma.
  locales: {
    'pt-BR': './src/locales/native/pt-BR.json',
    en: './src/locales/native/en.json',
  },
  ios: {
    bundleIdentifier: IDENTIFIER,
    supportsTablet: false,
    usesAppleSignIn: true,
    googleServicesFile: googleServicesIos,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
    },
    icon: './assets/expo.icon',
  },
  android: {
    package: IDENTIFIER,
    googleServicesFile: googleServicesAndroid,
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0F6B5C',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-build-properties',
      {
        // Exigido pelo React Native Firebase no iOS.
        ios: { useFrameworks: 'static' },
      },
    ],
    [
      'expo-localization',
      { supportedLocales: { ios: ['pt-BR', 'en'], android: ['pt-BR', 'en'] } },
    ],
    [
      'expo-image-picker',
      {
        // Textos padrão; os traduzidos ficam em src/locales/native/*.json.
        photosPermission: 'Allow $(PRODUCT_NAME) to access your photos to set your pet photo.',
        cameraPermission: 'Allow $(PRODUCT_NAME) to use the camera to photograph your pet.',
        microphonePermission: false,
      },
    ],
    'expo-apple-authentication',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme() }],
    '@sentry/react-native',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Preenchido por `eas init`.
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
