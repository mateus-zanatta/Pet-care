import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { type RgaImportResult, rgaImportRequestSchema, todayIso } from '@petcare/shared';
import { callableOptions } from '../config';
import { analyzeRgaFile } from './pipeline';

/**
 * Lê o PDF (ou imagem) do RG Animal enviado DIRETO na chamada (sem gravar no Storage) e devolve
 * os campos em JSON. Só para usuário com conta (não anônimo) e protegida por App Check.
 * 1 GiB de memória: o pdf.js decodifica a imagem de fundo inteira (≈310 MB medidos).
 *
 * PRIVACIDADE: nenhum valor lido vai para o log; só `ok`, `mode`, `reason`, `creator` (nome do
 * gerador do PDF) e os códigos de aviso.
 */
export const importRga = onCall({ ...callableOptions, memory: '1GiB', timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'auth-required');
  if (request.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'account-required');
  }

  const parsed = rgaImportRequestSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid-input');

  const bytes = Buffer.from(parsed.data.fileBase64, 'base64');
  const result: RgaImportResult = await analyzeRgaFile({
    bytes,
    mimeType: parsed.data.mimeType,
    today: todayIso(),
    // Motivo técnico de uma falha de leitura: só no log do servidor, sem nenhum valor do documento.
    onDiagnostic: (detail) => logger.warn('rga_read_diagnostic', { detail }),
  });

  logger.info('rga_import', {
    ok: result.recognized,
    mode: result.mode,
    reason: result.reason,
    creator: result.creator,
    warnings: result.warnings,
  });
  return result;
});
