import { getApp } from '@react-native-firebase/app';
import { httpsCallable } from '@react-native-firebase/functions';
import { FUNCTIONS_REGION } from '@petcare/shared';
import { auth, diagnoseEmulatorConnection, functions, getEmulatorHost } from './index';
import { EMULATOR_PORT } from './diagnostics';
import { type CallableBody, buildEmulatorCallableUrl, isNetworkError, unwrapCallableBody } from './callableProtocol';

/**
 * Chama uma Cloud Function "callable". Em produção usa o SDK do Firebase.
 * Com emuladores (desenvolvimento), usa HTTP direto com o token de login (veja callableProtocol.ts).
 */
export async function callFunction<Request = undefined, Response = unknown>(
  name: string,
  data?: Request,
): Promise<Response> {
  const emulatorHost = getEmulatorHost();

  if (!emulatorHost) {
    const result = await httpsCallable<Request | undefined, Response>(functions(), name)(data);
    return result.data;
  }

  try {
    const user = auth().currentUser;
    // Token novo: ações sensíveis conferem o horário do último login (reautenticação).
    const idToken = user ? await user.getIdToken(true) : null;
    const response = await fetch(
      buildEmulatorCallableUrl(emulatorHost, EMULATOR_PORT.functions, getApp().options.projectId ?? '', FUNCTIONS_REGION, name),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(idToken ? { authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ data: data ?? {} }),
      },
    );
    return unwrapCallableBody<Response>((await response.json()) as CallableBody);
  } catch (error) {
    if (isNetworkError(error)) diagnoseEmulatorConnection();
    throw error;
  }
}
