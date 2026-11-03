import { getApp } from '@react-native-firebase/app';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { connectStorageEmulator, getStorage } from '@react-native-firebase/storage';
import { FUNCTIONS_REGION } from '@petcare/shared';

/**
 * Acesso centralizado ao Firebase. Os getters são funções (e não constantes) para que o
 * app só toque no Firebase depois de iniciado e os testes possam trocá-los por mocks.
 */
export const auth = () => getAuth();
export const db = () => getFirestore();
export const storage = () => getStorage();
export const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);

let emulatorsConnected = false;

/**
 * Em desenvolvimento, aponta o app para os emuladores locais (npm run emulators).
 * Ative com EXPO_PUBLIC_USE_EMULATORS=true. Nunca roda em produção.
 */
export function connectEmulatorsIfEnabled(): void {
  if (emulatorsConnected || !__DEV__ || process.env.EXPO_PUBLIC_USE_EMULATORS !== 'true') return;
  emulatorsConnected = true;
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '10.0.2.2';
  connectAuthEmulator(auth(), `http://${host}:9099`);
  connectFirestoreEmulator(db(), host, 8080);
  connectStorageEmulator(storage(), host, 9199);
  connectFunctionsEmulator(functions(), host, 5001);
}
