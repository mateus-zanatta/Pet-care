/**
 * NOME DO APP: troque só aqui (e nas 2 linhas do apps/mobile/app.config.ts + locales/native, que o sistema lê no build).
 * Os textos do app usam {{appName}}, preenchido automaticamente com este valor.
 */
export const APP_NAME = 'Tailwag';

/** Região das Cloud Functions (São Paulo): menor latência no Brasil. */
export const FUNCTIONS_REGION = 'southamerica-east1';

/** Tempo máximo desde o último login para ações sensíveis (ex.: excluir a conta). */
export const RECENT_LOGIN_MAX_SECONDS = 5 * 60;
