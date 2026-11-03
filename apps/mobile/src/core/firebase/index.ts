import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { connectStorageEmulator, getStorage } from '@react-native-firebase/storage';
import { FUNCTIONS_REGION } from '@petcare/shared';
import Constants from 'expo-constants';
import { NativeModules } from 'react-native';
import { EMULATOR_PORT, pingEmulators, resolveEmulatorSettings } from './diagnostics';

/**
 * Acesso centralizado ao Firebase. Os getters são funções (e não constantes) para que o
 * app só toque no Firebase depois de iniciado e os testes possam trocá-los por mocks.
 */
export const auth = () => getAuth();
export const db = () => getFirestore();
export const storage = () => getStorage();
export const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

let emulatorsConnected = false;
let emulatorHost: string | null = null;

/** Endereço do computador dos emuladores, ou null quando o app usa o Firebase real. */
export const getEmulatorHost = (): string | null => emulatorHost;

/** True quando o app está falando com os emuladores locais (dados de teste, não os reais). */
export const isUsingEmulators = (): boolean => emulatorsConnected;

/** Endereço do Metro (o mesmo computador onde rodam os emuladores), descoberto em tempo de execução. */
function metroHostUri(): string | undefined {
  const fromConfig = Constants.expoConfig?.hostUri;
  if (fromConfig) return fromConfig;
  try {
    return (NativeModules.SourceCode as { scriptURL?: string } | undefined)?.scriptURL;
  } catch {
    return undefined;
  }
}

/**
 * Em desenvolvimento, aponta o app para os emuladores locais (npm run emulators:lan).
 * Liga sozinho quando o app foi gerado com o projeto falso "demo-*" (perfil development-emulators);
 * com um projeto real, ligue com EXPO_PUBLIC_USE_EMULATORS=true. Nunca roda em produção.
 */
export function connectEmulatorsIfEnabled(): void {
  if (emulatorsConnected || !__DEV__) return;

  const settings = resolveEmulatorSettings({
    flag: process.env.EXPO_PUBLIC_USE_EMULATORS,
    explicitHost: process.env.EXPO_PUBLIC_EMULATOR_HOST,
    metroHostUri: metroHostUri(),
    projectId: getApp().options.projectId,
  });

  if (!settings.enabled) {
    console.log(`[firebase] emuladores DESLIGADOS: ${settings.reason}. O app usará o Firebase real.`);
    return;
  }

  emulatorsConnected = true;
  const { host } = settings;
  emulatorHost = host;
  console.log(`[firebase] emuladores LIGADOS em ${host} (${settings.reason}; endereço: ${settings.hostSource})`);
  connectAuthEmulator(auth(), `http://${host}:${EMULATOR_PORT.auth}`);
  connectFirestoreEmulator(db(), host, EMULATOR_PORT.firestore);
  connectStorageEmulator(storage(), host, EMULATOR_PORT.storage);
  connectFunctionsEmulator(functions(), host, EMULATOR_PORT.functions);

  // Diagnóstico (só no console de desenvolvimento): o celular alcança o computador?
  void pingEmulators(host).then((results) => {
    for (const r of results) console.log(`[firebase] ${r.ok ? 'OK   ' : 'FALHA'} ${r.name} :${r.port} -> ${r.detail}`);
  });
}
