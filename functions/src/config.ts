import { defineBoolean } from 'firebase-functions/params';

/**
 * App Check: garante que a chamada veio do app instalado (Play Integrity / App Attest).
 * Começa DESLIGADO para você poder testar antes de configurar o App Check no console;
 * ligue com ENFORCE_APP_CHECK=true (functions/.env.<projeto>) quando o app já enviar o token.
 */
export const enforceAppCheck = defineBoolean('ENFORCE_APP_CHECK', { default: false });
