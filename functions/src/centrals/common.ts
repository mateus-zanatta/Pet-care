import { type CentralKind, DAILY_LIMITS, isOwnPhotoPath } from '@petcare/shared';
import type { Bucket } from '@google-cloud/storage';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

/** Data em UTC para as cotas diárias ("2026-11-06"). */
export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/**
 * LIMITE DIÁRIO (rate limit) por pessoa e por central, dentro da mesma transação que grava o registro:
 * duas chamadas simultâneas não conseguem passar do limite. Documento `rate_limits/{uid}_{central}_{dia}`.
 */
export async function consumeDailyQuota(tx: Transaction, firestore: Firestore, uid: string, kind: CentralKind, now: Date) {
  const ref = firestore.collection('rate_limits').doc(`${uid}_${kind}_${utcDay(now)}`);
  const snap = await tx.get(ref);
  const count = (snap.data()?.count as number | undefined) ?? 0;
  if (count >= DAILY_LIMITS[kind]) throw new HttpsError('resource-exhausted', 'daily-limit');
  tx.set(ref, { uid, kind, day: utcDay(now), count: count + 1 }, { merge: true });
}

/** As centrais exigem conta de verdade (anônimo não cria nada: reduz spam e permite responsabilizar abuso). */
export function requireRegistered(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'auth-required');
  if (request.auth.token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', 'account-required');
  return request.auth.uid;
}

/** O Firestore não aceita `undefined`: remove campos vazios (opcionais não preenchidos). */
export function compact<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

export function assertOwnPhotos(kind: CentralKind, id: string, paths: readonly string[]) {
  if (!paths.every((p) => isOwnPhotoPath(kind, id, p))) throw new HttpsError('invalid-argument', 'invalid-photo-path');
}

/** Apaga do Storage as fotos que saíram da lista (as que ficaram continuam). */
export async function deleteRemovedPhotos(bucket: Bucket, before: readonly string[], after: readonly string[]) {
  const removed = before.filter((p) => !after.includes(p));
  await Promise.all(removed.map((p) => bucket.file(p).delete({ ignoreNotFound: true })));
}
