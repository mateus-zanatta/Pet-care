import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { MAX_SUGGESTIONS_PER_DAY, placeSuggestionRequestSchema } from '@petcare/shared';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { db } from '../admin';
import { callableOptions } from '../config';

/** Data em UTC para a cota diária ("2026-11-04"). */
const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/**
 * Grava a sugestão em `place_suggestions` com status "pending" (a moderação acontece no painel da Fase 7).
 * Limite de MAX_SUGGESTIONS_PER_DAY por pessoa por dia, controlado numa transação (sem corrida).
 */
export async function handleSuggestPlace(uid: string, data: unknown, firestore: Firestore, now: Date) {
  const parsed = placeSuggestionRequestSchema.safeParse(data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'invalid-input');
  const suggestion = parsed.data;
  if (suggestion.kind === 'fix' && !suggestion.placeId) throw new HttpsError('invalid-argument', 'invalid-input');

  const quotaRef = firestore.collection('suggestion_quota').doc(`${uid}_${utcDay(now)}`);
  const suggestionRef = firestore.collection('place_suggestions').doc();

  await firestore.runTransaction(async (tx) => {
    const quota = await tx.get(quotaRef);
    const count = (quota.data()?.count as number | undefined) ?? 0;
    if (count >= MAX_SUGGESTIONS_PER_DAY) throw new HttpsError('resource-exhausted', 'daily-limit');
    tx.set(quotaRef, { uid, day: utcDay(now), count: count + 1 }, { merge: true });
    tx.set(suggestionRef, {
      ...suggestion,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      status: 'pending',
    });
  });
  return { ok: true as const, id: suggestionRef.id };
}

/** Só para quem tem conta (reduz spam). O conteúdo nunca vai para o log. */
export const suggestPlace = onCall({ ...callableOptions, memory: '256MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'auth-required');
  if (request.auth.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', 'account-required');
  const result = await handleSuggestPlace(request.auth.uid, request.data, db(), new Date());
  logger.info('place_suggested', { kind: (request.data as { kind?: string })?.kind });
  return result;
});
