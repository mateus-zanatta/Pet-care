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
