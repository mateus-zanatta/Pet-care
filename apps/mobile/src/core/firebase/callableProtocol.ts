/**
 * Protocolo "callable" do Firebase por HTTP puro. Usado só no desenvolvimento com emuladores:
 * a biblioteca nativa de Functions consulta serviços reais do Google (identificação do
 * aparelho) que não aceitam a configuração falsa do modo só-emuladores.
 * É o mesmo formato que os testes de funções (functions/src/callables.emu.test.ts) usam.
 */

export function buildEmulatorCallableUrl(host: string, port: number, projectId: string, region: string, name: string): string {
  return `http://${host}:${port}/${projectId}/${region}/${name}`;
}

export type CallableBody = {
  result?: unknown;
  error?: { message?: string; status?: string };
};

/** "FAILED_PRECONDITION" -> "functions/failed-precondition" (mesmo padrão dos erros do SDK). */
export function callableErrorCode(status?: string): string {
  return `functions/${(status ?? 'unknown').toLowerCase().replace(/_/g, '-')}`;
}

/** Devolve `result` ou lança um erro com `code` (ex.: "functions/permission-denied"). */
export function unwrapCallableBody<T>(body: CallableBody): T {
  if (body.error) {
    throw Object.assign(new Error(body.error.message ?? 'callable error'), {
      code: callableErrorCode(body.error.status),
    });
  }
  return body.result as T;
}

/** Código do Firebase para o status HTTP de uma resposta que não veio no formato "callable". */
const HTTP_TO_STATUS: Record<number, string> = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  429: 'RESOURCE_EXHAUSTED',
  503: 'UNAVAILABLE',
  504: 'DEADLINE_EXCEEDED',
};

/**
 * Lê a resposta do emulador. Quase sempre é JSON ({ result } ou { error }), mas nem sempre: se a função
 * NÃO EXISTE no emulador (ex.: emuladores abertos antes de atualizar o código), ele responde 404 em texto puro.
 * Nesse caso devolvemos um erro com código de verdade ("functions/not-found") em vez de um "JSON inválido" sem pista.
 */
export function parseCallableResponse(httpStatus: number, text: string): CallableBody {
  try {
    const body = JSON.parse(text) as unknown;
    if (body && typeof body === 'object' && ('result' in body || 'error' in body)) return body as CallableBody;
  } catch {
    // não é JSON: cai no tratamento abaixo
  }
  if (httpStatus >= 200 && httpStatus < 300) return { error: { message: 'bad-response', status: 'INTERNAL' } };
  return {
    error: {
      message: httpStatus === 404 ? 'function-not-found' : `http-${httpStatus}`,
      status: HTTP_TO_STATUS[httpStatus] ?? 'INTERNAL',
    },
  };
}

/** O erro é de rede (sem resposta do servidor), e não uma recusa do servidor? */
export function isNetworkError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message : '';
  return (
    code === 'auth/network-request-failed' ||
    code === 'functions/unavailable' ||
    code === 'functions/deadline-exceeded' ||
    /network request failed|network error|timed? ?out|unreachable host/i.test(message)
  );
}
