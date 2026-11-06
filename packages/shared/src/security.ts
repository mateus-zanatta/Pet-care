/**
 * Segurança de conta: senha forte e espera crescente entre tentativas de login.
 * Funções puras (testadas em security.test.ts), usadas pelo app e reutilizáveis no servidor.
 */

/* --------------------------------- Senha forte --------------------------------- */

export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_RULES = ['length', 'lower', 'upper', 'digit', 'symbol', 'noRepeat', 'notPersonal', 'notCommon'] as const;
export type PasswordRule = (typeof PASSWORD_RULES)[number];

/** Senhas que aparecem no topo de todo vazamento (com variações comuns). Lista curta de propósito: as regras cobrem o resto. */
const COMMON = [
  '123456', '12345678', '123456789', '1234567890', 'senha', 'password', 'qwerty', 'abc123', 'admin', 'iloveyou',
  'brasil', 'mudar', 'teste', 'flamengo', 'corinthians', 'palmeiras', 'gremio', 'cruzeiro', 'pet', 'petcare',
  'cachorro', 'gato', 'amor', 'deus', 'jesus',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Regras que a senha NÃO cumpre (vazio = senha forte). Exige: 10+ caracteres, minúscula, maiúscula, número,
 * símbolo, nada de 3 caracteres iguais seguidos, sem o nome ou o e-mail da pessoa e sem ser uma senha batida.
 */
export function unmetPasswordRules(password: string, personal: { email?: string; name?: string } = {}): PasswordRule[] {
  const unmet: PasswordRule[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) unmet.push('length');
  if (!/[a-z]/.test(password)) unmet.push('lower');
  if (!/[A-Z]/.test(password)) unmet.push('upper');
  if (!/\d/.test(password)) unmet.push('digit');
  if (!/[^A-Za-z0-9]/.test(password)) unmet.push('symbol');
  if (/(.)\1\1/.test(password)) unmet.push('noRepeat');

  const flat = normalize(password);
  const pieces = [
    ...(personal.email ? [personal.email.split('@')[0] ?? ''] : []),
    ...(personal.name ? personal.name.split(/\s+/) : []),
  ]
    .map(normalize)
    .filter((p) => p.length >= 3);
  if (pieces.some((p) => flat.includes(p))) unmet.push('notPersonal');

  // "Senha@2024" ainda é "senha": tiramos números e símbolos das pontas antes de comparar.
  const core = flat.replace(/^\d+|\d+$/g, '');
  if (COMMON.some((c) => core === c || flat === c || (c.length >= 5 && core.startsWith(c) && core.length - c.length <= 2))) {
    unmet.push('notCommon');
  }
  return unmet;
}

/** 0 (muito fraca) a 4 (forte), para a barrinha da tela de cadastro. */
export function passwordScore(password: string, personal: { email?: string; name?: string } = {}): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const unmet = unmetPasswordRules(password, personal);
  if (unmet.includes('notCommon') || unmet.includes('notPersonal')) return 1;
  const passed = PASSWORD_RULES.length - unmet.length;
  if (unmet.length === 0) return password.length >= 14 ? 4 : 3;
  if (passed >= 6) return 2;
  return 1;
}

/* ------------------------- Espera crescente no login ------------------------- */

/** Erros seguidos que não geram espera (todo mundo erra a senha uma vez). */
export const LOGIN_FREE_ATTEMPTS = 2;
const LOGIN_BASE_DELAY_MS = 2_000;
export const LOGIN_MAX_DELAY_MS = 15 * 60_000;
/** Sem erros por esse tempo, a contagem zera. */
export const LOGIN_FAILURE_RESET_MS = 24 * 60 * 60_000;

/**
 * Espera antes da PRÓXIMA tentativa depois de `failures` erros seguidos: 2 s, 4 s, 8 s, 16 s... (dobra a cada erro),
 * até 15 minutos. As 2 primeiras falhas não esperam.
 */
export function loginDelayMs(failures: number): number {
  const extra = failures - LOGIN_FREE_ATTEMPTS;
  if (extra <= 0) return 0;
  return Math.min(LOGIN_BASE_DELAY_MS * 2 ** (extra - 1), LOGIN_MAX_DELAY_MS);
}

export type LoginAttemptState = { failures: number; lastFailureAt: number };

/** Registra um erro (zerando a contagem se o último foi há mais de 24 h). */
export function recordLoginFailure(state: LoginAttemptState | null, now: number): LoginAttemptState {
  const fresh = !state || now - state.lastFailureAt > LOGIN_FAILURE_RESET_MS;
  return { failures: fresh ? 1 : state.failures + 1, lastFailureAt: now };
}

/** Quantos ms ainda faltam para poder tentar de novo (0 = pode tentar). */
export function loginWaitRemainingMs(state: LoginAttemptState | null, now: number): number {
  if (!state || now - state.lastFailureAt > LOGIN_FAILURE_RESET_MS) return 0;
  return Math.max(0, state.lastFailureAt + loginDelayMs(state.failures) - now);
}
