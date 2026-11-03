import { FUNCTIONS_REGION } from '@petcare/shared';

/**
 * App Check: garante que a chamada veio do app instalado (Play Integrity / App Attest).
 * Começa DESLIGADO para você poder testar antes de configurar o App Check no console;
 * ligue com ENFORCE_APP_CHECK=true em functions/.env (ou functions/.env.<projeto>)
 * quando o app já enviar o token.
 */
export const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';

/**
 * Opções comuns a todas as funções chamáveis. A região é passada EXPLICITAMENTE em cada
 * função (e não via setGlobalOptions): os imports são avaliados antes do corpo do index.ts,
 * então uma configuração global feita ali chegava tarde e as funções caíam em us-central1.
 */
export const callableOptions = {
  region: FUNCTIONS_REGION,
  enforceAppCheck,
  maxInstances: 10,
} as const;
