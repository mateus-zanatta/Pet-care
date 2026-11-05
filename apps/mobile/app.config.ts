import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { fakeGoogleServiceInfoPlist, fakeGoogleServicesJson } from './config/fakeFirebaseConfig';

/**
 * Configuração do app. Valores que dependem de VOCÊ vêm de variáveis de ambiente
 * (veja .env.example e docs/SETUP.md) — nada secreto fica no repositório.
 */
/**
 * DADOS DO PROJETO NO EXPO — copie da página do projeto em expo.dev (botão "Details").
 * Nada disso é segredo. O Expo confere se batem com o projeto; se um deles estiver errado,
 * o build para com uma mensagem dizendo qual.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '2d4092b3-0d00-4131-965e-1f6f2f042c83';
/** "Slug" do projeto no Expo (aparece em Details). Precisa ser idêntico ao do site. */
const EXPO_SLUG = process.env.EXPO_SLUG ?? 'pet-care';
/** Nome da conta/organização dona do projeto (aparece em Details). Deixe vazio se for a sua conta pessoal. */
const EXPO_OWNER = process.env.EXPO_OWNER ?? '';

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

/**
 * MODO SÓ EMULADORES (FIREBASE_EMULATOR_ONLY=true): não precisa de projeto Firebase nem de
 * cartão. O React Native Firebase exige os arquivos de configuração para abrir o app; aqui
 * geramos arquivos FALSOS (projeto "demo-petcare", o mesmo dos emuladores) na hora do build.
 * Nunca é aceito em build de preview/produção.
 */
const EMULATOR_ONLY = process.env.FIREBASE_EMULATOR_ONLY === 'true';
const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE;
if (EMULATOR_ONLY && (BUILD_PROFILE === 'production' || BUILD_PROFILE === 'preview')) {
  throw new Error('FIREBASE_EMULATOR_ONLY não pode ser usado em builds de preview ou produção.');
}

const GENERATED_DIR = path.resolve(__dirname, 'firebase/.generated');
const GENERATED_ANDROID = './firebase/.generated/google-services.json';
const GENERATED_IOS = './firebase/.generated/GoogleService-Info.plist';

function writeFakeFirebaseFiles(): void {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(path.join(GENERATED_DIR, 'google-services.json'), fakeGoogleServicesJson(IDENTIFIER));
  fs.writeFileSync(path.join(GENERATED_DIR, 'GoogleService-Info.plist'), fakeGoogleServiceInfoPlist(IDENTIFIER));
}

if (EMULATOR_ONLY) writeFakeFirebaseFiles();

const googleServicesAndroid = EMULATOR_ONLY
  ? GENERATED_ANDROID
  : existingFile('GOOGLE_SERVICES_JSON', './firebase/google-services.json');
const googleServicesIos = EMULATOR_ONLY
  ? GENERATED_IOS
  : existingFile('GOOGLE_SERVICES_PLIST', './firebase/GoogleService-Info.plist');

/**
 * Chave do Google Maps para o MAPA no Android (o iPhone usa o Apple Maps, sem chave).
 * Exige conta de cobrança no Google Cloud. Sem ela, a tela "Perto de mim" funciona em LISTA e "Como chegar"
 * abre o app de mapas do celular. Para ativar: variável de ambiente GOOGLE_MAPS_ANDROID_API_KEY no EAS.
 */
const GOOGLE_MAPS_ANDROID_API_KEY = process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '';

/** Builds de desenvolvimento precisam falar com os emuladores por HTTP (sem https) na rede local. */
const ALLOW_CLEARTEXT = EMULATOR_ONLY || BUILD_PROFILE === 'development';

/**
 * Arquiteturas Android a compilar (ex.: "arm64-v8a"). Por padrão são 4 (armeabi-v7a, arm64-v8a,
 * x86, x86_64), o que deixa o build bem mais lento. Em desenvolvimento, só "arm64-v8a" cobre
 * praticamente todo celular Android moderno. Em produção, deixe vazio (compila todas).
 */
const ANDROID_ARCHS = (process.env.ANDROID_BUILD_ARCHS ?? '')
  .split(',')
  .map((arch: string) => arch.trim())
  .filter(Boolean);

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
  slug: EXPO_SLUG,
  ...(EXPO_OWNER ? { owner: EXPO_OWNER } : {}),
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
        // Só em desenvolvimento: permite HTTP para os emuladores na rede local.
        android: {
          usesCleartextTraffic: ALLOW_CLEARTEXT,
          ...(ANDROID_ARCHS.length > 0 ? { buildArchs: ANDROID_ARCHS } : {}),
        },
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
    [
      'expo-location',
      {
        // Só "durante o uso" (nunca em segundo plano). Textos traduzidos em src/locales/native/*.json.
        locationWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location to show vets, pet shops and shelters near you.',
      },
    ],
    ['react-native-maps', GOOGLE_MAPS_ANDROID_API_KEY ? { androidGoogleMapsApiKey: GOOGLE_MAPS_ANDROID_API_KEY } : {}],
    [
      'expo-notifications',
      {
        // Ícone pequeno das notificações no Android (silhueta branca; sem ele aparece um quadrado cinza).
        icon: './assets/images/android-icon-monochrome.png',
        color: '#0F6B5C',
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
    // Preenchido por `eas init` (veja EAS_PROJECT_ID no topo deste arquivo).
    eas: { projectId: EAS_PROJECT_ID },
    // O app só mostra o mapa no Android se o build tiver a chave (a chave em si não vai para cá).
    googleMapsAndroid: GOOGLE_MAPS_ANDROID_API_KEY !== '',
  },
});
