import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import {
  type Firestore,
  connectFirestoreEmulator,
  doc,
  getDocFromServer,
  getFirestore,
} from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { connectStorageEmulator, getStorage } from '@react-native-firebase/storage';
import { FUNCTIONS_REGION } from '@petcare/shared';
import Constants from 'expo-constants';
import { NativeModules } from 'react-native';
import {
  EMULATOR_PORT,
  classifyFirestoreProbe,
  pingEmulators,
  resolveEmulatorSettings,
  withTimeout,
} from './diagnostics';

/**
 * Acesso centralizado ao Firebase. Os getters são funções (e não constantes) para que o
 * app só toque no Firebase depois de iniciado e os testes possam trocá-los por mocks.
 */
export const auth = () => getAuth();
export const db = (): Firestore => getFirestore();
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

/** Roda `connect` sem deixar um erro dele derrubar a abertura do app: só avisa no console. */
function connectSafely(name: string, connect: () => void): void {
  try {
    connect();
  } catch (error) {
    console.warn(`[firebase] não foi possível apontar ${name} para o emulador:`, (error as Error)?.message ?? error);
  }
}

/**
 * Em desenvolvimento, aponta o app para os emuladores locais (npm run emulators:lan).
 * Liga sozinho quando o app foi gerado com o projeto falso "demo-*" (perfil development-emulators);
 * com um projeto real, ligue com EXPO_PUBLIC_USE_EMULATORS=true. Nunca roda em produção.
 *
 * É assíncrona de propósito: o app deve ESPERAR por ela antes de usar Auth/Firestore (veja app/_layout.tsx).
 * Nunca lança erro; no pior caso registra o motivo no console e o app abre mesmo assim.
 */
export async function connectEmulatorsIfEnabled(): Promise<void> {
  if (emulatorsConnected || !__DEV__) return;

  let settings: ReturnType<typeof resolveEmulatorSettings>;
  try {
    settings = resolveEmulatorSettings({
      flag: process.env.EXPO_PUBLIC_USE_EMULATORS,
      explicitHost: process.env.EXPO_PUBLIC_EMULATOR_HOST,
      metroHostUri: metroHostUri(),
      projectId: getApp().options.projectId,
    });
  } catch (error) {
    console.warn('[firebase] não foi possível decidir sobre os emuladores:', (error as Error)?.message ?? error);
    return;
  }

  if (!settings.enabled) {
    console.log(`[firebase] emuladores DESLIGADOS: ${settings.reason}. O app usará o Firebase real.`);
    return;
  }

  emulatorsConnected = true;
  const { host } = settings;
  emulatorHost = host;
  console.log(`[firebase] emuladores LIGADOS em ${host} (${settings.reason}; endereço: ${settings.hostSource})`);

  connectSafely('o Auth', () => connectAuthEmulator(auth(), `http://${host}:${EMULATOR_PORT.auth}`));
  connectSafely('o Storage', () => connectStorageEmulator(storage(), host, EMULATOR_PORT.storage));
  connectSafely('o Functions', () => connectFunctionsEmulator(functions(), host, EMULATOR_PORT.functions));

  // Com emuladores, o cache local do Firestore NÃO pode sobreviver ao emulador: ao reiniciá-lo os dados somem,
  // mas o cache do celular continuaria mostrando pets "fantasma" (que não existem no servidor).
  // ATENÇÃO À ORDEM: no Android o settings() só vale se for gravado ANTES de a instância nativa existir, e o
  // useEmulator() é quem a cria. Por isso o settings() é ESPERADO (com limite de tempo) antes do useEmulator().
  try {
    // `settings` existe no RNFirebase (API documentada), mas não aparece no tipo público do Firestore.
    const configurable = getFirestore() as unknown as { settings(options: { persistence: boolean }): Promise<void> };
    await withTimeout(configurable.settings({ persistence: false }), 3000, 'Firestore.settings');
  } catch (error) {
    console.warn('[firebase] não foi possível desligar o cache local do Firestore:', (error as Error)?.message ?? error);
  }
  connectSafely('o Firestore', () => connectFirestoreEmulator(db(), host, EMULATOR_PORT.firestore));

  // Diagnóstico (só no console de desenvolvimento), sem atrasar a abertura do app.
  void pingEmulators(host).then((results) => {
    for (const r of results) console.log(`[firebase] ${r.ok ? 'OK   ' : 'FALHA'} ${r.name} :${r.port} -> ${r.detail}`);
  });
  void probeFirestoreServer();
}

/**
 * Lê um documento qualquer DIRETO NO SERVIDOR do Firestore. É a prova de que as gravações chegam: o ping HTTP
 * só mostra que a porta abre, mas o app grava por gRPC. "permission-denied" também vale (o servidor respondeu).
 */
async function probeFirestoreServer(): Promise<void> {
  let failure: unknown = null;
  try {
    await withTimeout(getDocFromServer(doc(db(), '_diagnostico', 'ping')), 12_000, 'Firestore');
  } catch (error) {
    failure = error;
  }
  const result = classifyFirestoreProbe(failure);
  const line = `[firebase] ${result.reached ? 'OK   ' : 'FALHA'} Firestore (canal das gravações) -> ${result.detail}`;
  if (result.reached) console.log(line);
  else {
    console.warn(line);
    console.warn(
      '[firebase] Sem esse canal, o app mostra o pet mas ele NÃO chega ao servidor (a foto não é enviada e excluir dá "owner-only"). ' +
        'Confira: o Firestore (Java) está rodando em npm run emulators:lan? O Firewall do Windows permite o Java em redes privadas?',
    );
  }
}

/**
 * Quando uma chamada falha por rede com os emuladores ligados, testa cada porta e mostra no console
 * de desenvolvimento qual não responde (computador desligado/suspenso, IP mudou, Firewall...).
 */
export function diagnoseEmulatorConnection(): void {
  if (!__DEV__ || !emulatorHost) return;
  const host = emulatorHost;
  console.warn(`[firebase] Falha de rede falando com os emuladores em ${host}. Testando as portas...`);
  void pingEmulators(host).then((results) => {
    for (const r of results) console.warn(`[firebase] ${r.ok ? 'OK   ' : 'FALHA'} ${r.name} :${r.port} -> ${r.detail}`);
    if (results.some((r) => !r.ok)) {
      console.warn(
        '[firebase] Confira: 1) os emuladores (npm run emulators:lan) estão rodando; 2) o IP do computador ainda é ' +
          `${host} (rode ipconfig); 3) celular e computador estão no mesmo Wi-Fi; 4) o Firewall permite o Java.`,
      );
    }
  });
}
