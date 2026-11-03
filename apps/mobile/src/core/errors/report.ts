import * as Sentry from '@sentry/react-native';

/**
 * Relato de erros SEM dados pessoais (LGPD): o Sentry recebe apenas um contexto fixo
 * (ex.: "pets.save") e o código técnico do erro (ex.: "auth/invalid-credential"),
 * nunca a mensagem, que pode conter e-mail, nomes ou valores do RG.
 */
const CODE_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+$/i;

export function errorCodeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && CODE_PATTERN.test(code) ? code : 'unknown';
}

export function reportError(context: string, error?: unknown): void {
  const code = errorCodeOf(error);
  // No console de desenvolvimento (nunca enviado ao Sentry) mostramos também a mensagem original.
  if (__DEV__) console.warn(`[erro] ${context} (${code})`, (error as Error | undefined)?.message ?? '');
  Sentry.captureMessage(`${context} (${code})`, { level: 'error', tags: { context, code } });
}

/**
 * Falha na importação do RG Animal: registra SÓ o motivo (código fixo) e o texto do metadado
 * "Creator" do PDF (nome do gerador do documento, para notar mudança de modelo). Nunca valores do RG.
 */
export function reportRgaImportFailure(reason: string, creator?: string): void {
  const safeCreator = (creator ?? '').replace(/[^A-Za-z0-9 ._()/+-]/g, '').slice(0, 80);
  if (__DEV__) console.warn(`[rga] importação não reconhecida: ${reason}`);
  Sentry.captureMessage('rga_import_failed', {
    level: 'warning',
    tags: { reason, ...(safeCreator ? { creator: safeCreator } : {}) },
  });
}

/** Remove de cada evento tudo o que poderia identificar a pessoa. */
export function scrubSentryEvent<T extends Sentry.ErrorEvent>(event: T): T {
  delete event.user;
  delete event.request;
  delete event.breadcrumbs;
  if (event.exception?.values) {
    for (const value of event.exception.values) {
      // A mensagem de uma exceção pode conter dados digitados pela pessoa.
      value.value = CODE_PATTERN.test(value.value ?? '') ? value.value : '[redacted]';
    }
  }
  if (event.extra) event.extra = {};
  return event;
}

export function initErrorReporting(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: Boolean(dsn) && !__DEV__,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableUserInteractionTracing: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeBreadcrumb: () => null,
  });
}
