import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { petMemberId } from '@petcare/shared';
import { z } from 'zod';
import { bucket, db } from '../admin';
import { deletePetCascade } from '../account/deletion';
import { enforceAppCheck } from '../config';

const inputSchema = z.object({ petId: z.string().min(1).max(128) });

/** Exclui um pet inteiro (dados de saúde, vínculos e arquivos). Somente o dono pode. */
export const deletePet = onCall({ enforceAppCheck, memory: '512MiB', timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'auth-required');

  const parsed = inputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid-input');
  const { petId } = parsed.data;

  const membership = await db().collection('pet_members').doc(petMemberId(petId, request.auth.uid)).get();
  if (!membership.exists || membership.data()?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'owner-only');
  }

  await deletePetCascade({ db: db(), bucket: bucket() }, petId);
  logger.info('pet_deleted');
  return { ok: true };
});
