import AsyncStorage from '@react-native-async-storage/async-storage';
import { type LoginAttemptState, loginWaitRemainingMs, recordLoginFailure } from '@petcare/shared';
import * as Crypto from 'expo-crypto';

/**
 * ESPERA CRESCENTE entre tentativas de login com senha errada: 2 erros livres, depois 2 s, 4 s, 8 s... até 15 min.
 * Conta por e-mail E pelo aparelho (trocar de e-mail não zera a espera). O e-mail nunca é guardado: só um hash.
 *
 * Limite honesto: isto roda no app. A proteção que o atacante não contorna é a do próprio Firebase Authentication,
 * que bloqueia tentativas em excesso no servidor ("auth/too-many-requests"); veja docs/SEGURANCA.md.
 */
const PREFIX = 'login-guard-v1:';
const DEVICE_KEY = `${PREFIX}device`;
/** O aparelho só passa a esperar depois de mais erros (várias pessoas podem usar o mesmo celular). */
const DEVICE_SLACK = 3;

async function emailKey(email: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email.trim().toLowerCase());
  return `${PREFIX}${digest.slice(0, 32)}`;
}

async function read(key: string): Promise<LoginAttemptState | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as LoginAttemptState) : null;
    return parsed && typeof parsed.failures === 'number' && typeof parsed.lastFailureAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

async function write(key: string, state: LoginAttemptState | null): Promise<void> {
  try {
    if (state) await AsyncStorage.setItem(key, JSON.stringify(state));
    else await AsyncStorage.removeItem(key);
  } catch {
    // sem armazenamento: o login continua funcionando (o Firebase ainda limita no servidor)
  }
}

/** Quantos ms faltam para poder tentar de novo com este e-mail (0 = pode tentar). */
export async function loginWaitMs(email: string, now = Date.now()): Promise<number> {
  const [byEmail, byDevice] = await Promise.all([read(await emailKey(email)), read(DEVICE_KEY)]);
  const device = byDevice ? { ...byDevice, failures: byDevice.failures - DEVICE_SLACK } : null;
  return Math.max(loginWaitRemainingMs(byEmail, now), loginWaitRemainingMs(device, now));
}

/** Senha/e-mail errados: conta mais um erro (por e-mail e no aparelho). */
export async function registerLoginFailure(email: string, now = Date.now()): Promise<void> {
  const key = await emailKey(email);
  const [byEmail, byDevice] = await Promise.all([read(key), read(DEVICE_KEY)]);
  await Promise.all([write(key, recordLoginFailure(byEmail, now)), write(DEVICE_KEY, recordLoginFailure(byDevice, now))]);
}

/** Login certo: zera a contagem deste e-mail e do aparelho. */
export async function clearLoginFailures(email: string): Promise<void> {
  await Promise.all([write(await emailKey(email), null), write(DEVICE_KEY, null)]);
}
