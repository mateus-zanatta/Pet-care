import { RECENT_LOGIN_MAX_SECONDS } from '@petcare/shared';

/**
 * `auth_time` é o instante (em segundos) do último login com credencial, vindo do token
 * já verificado pelo Firebase. Exigir login recente impede que um aparelho esquecido
 * desbloqueado apague uma conta inteira sem a pessoa confirmar a senha/conta.
 */
export function isRecentLogin(
  authTimeSeconds: number | undefined,
  nowMs: number = Date.now(),
  maxSeconds: number = RECENT_LOGIN_MAX_SECONDS,
): boolean {
  if (typeof authTimeSeconds !== 'number' || !Number.isFinite(authTimeSeconds)) return false;
  const ageSeconds = nowMs / 1000 - authTimeSeconds;
  return ageSeconds >= -60 && ageSeconds <= maxSeconds; // tolera 1 min de diferença de relógio
}
