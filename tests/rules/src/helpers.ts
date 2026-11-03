import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type RulesTestEnvironment,
  type TokenOptions,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'demo-petcare';
const root = resolve(__dirname, '../../..');

export async function createEnv(): Promise<RulesTestEnvironment> {
  const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  const [storageHost, storagePort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'),
    },
    storage: {
      host: storageHost,
      port: Number(storagePort),
      rules: readFileSync(resolve(root, 'storage.rules'), 'utf8'),
    },
  });
}

/** Token de uma conta "de verdade" (e-mail/Google/Apple). */
export const registered: TokenOptions = { firebase: { sign_in_provider: 'password' } };
/** Token de uma conta anônima. */
export const anonymous: TokenOptions = { firebase: { sign_in_provider: 'anonymous' } };

export const validPet = (ownerId: string, overrides: Record<string, unknown> = {}) => ({
  ownerId,
  origin: 'manual',
  name: 'Mel',
  species: 'cat',
  sex: 'female',
  neutered: 'yes',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
