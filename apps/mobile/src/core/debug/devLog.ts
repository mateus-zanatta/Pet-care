/**
 * Log só de desenvolvimento (aparece no terminal do Metro). Nunca receba aqui valores do documento
 * do RG, nomes, telefones ou e-mails: só estados técnicos ("gravação confirmada", "foto enviada").
 */
export function devLog(scope: string, message: string): void {
  if (__DEV__) console.log(`[${scope}] ${message}`);
}
