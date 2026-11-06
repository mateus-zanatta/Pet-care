import {
  CENTRAL_STORAGE_ROOT,
  adoptionInputSchema,
  adoptionPoint,
  adoptionUpdateSchema,
  reportInputSchema,
  reportPhotosSchema,
  rescueAlertInputSchema,
  rescueAlertUpdateSchema,
} from '@petcare/shared';
import type { Bucket } from '@google-cloud/storage';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { assertOwnPhotos, compact, consumeDailyQuota, deleteRemovedPhotos } from './common';

export type Deps = { db: Firestore; bucket: Bucket; now: Date };

function invalid(): never {
  throw new HttpsError('invalid-argument', 'invalid-input');
}

/* ---------------------------------- Adoção ---------------------------------- */

/**
 * Cria um anúncio de adoção. O telefone fica num documento à parte (`private/contact`), que só pessoas com
 * cadastro podem ler; a coordenada é arredondada na grade (~1 km) aqui também.
 */
export async function createAdoption(uid: string, ownerName: string | undefined, data: unknown, { db, now }: Deps) {
  const parsed = adoptionInputSchema.safeParse(data);
  if (!parsed.success) invalid();
  const { contactPhone, lat: _lat, lng: _lng, ...publicData } = parsed.data;
  const point = adoptionPoint(parsed.data);
  const ref = db.collection('adoption_listings').doc();

  await db.runTransaction(async (tx) => {
    await consumeDailyQuota(tx, db, uid, 'adoption', now);
    tx.set(
      ref,
      compact({
        ...publicData,
        ...(point ?? {}),
        ownerId: uid,
        ownerName: ownerName?.slice(0, 80),
        status: 'available',
        photoPaths: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
    tx.set(ref.collection('private').doc('contact'), { ownerId: uid, contactPhone });
  });
  return { id: ref.id };
}

async function ownedDoc(db: Firestore, collection: string, id: string, field: string, uid: string) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'not-found');
  if (snap.data()?.[field] !== uid) throw new HttpsError('permission-denied', 'owner-only');
  return { ref, data: snap.data() as Record<string, unknown> };
}

export async function updateAdoption(uid: string, data: unknown, { db, bucket }: Deps) {
  const parsed = adoptionUpdateSchema.safeParse(data);
  if (!parsed.success) invalid();
  const { id, data: changes, status, photoPaths } = parsed.data;
  const { ref, data: current } = await ownedDoc(db, 'adoption_listings', id, 'ownerId', uid);
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (changes) {
    // Revalida o anúncio INTEIRO (atual + mudanças) para nunca gravar um estado inválido.
    const contact = (await ref.collection('private').doc('contact').get()).data()?.contactPhone as string | undefined;
    const merged = adoptionInputSchema.safeParse({ ...current, contactPhone: contact, ...changes });
    if (!merged.success) invalid();
    const { contactPhone, lat: _lat, lng: _lng, ...publicData } = merged.data;
    const point = adoptionPoint(merged.data);
    Object.assign(update, publicData, point ?? { lat: FieldValue.delete(), lng: FieldValue.delete() });
    for (const key of ['name', 'breed', 'size', 'healthNotes'] as const) {
      if (publicData[key] === undefined) update[key] = FieldValue.delete();
    }
    await ref.collection('private').doc('contact').set({ ownerId: uid, contactPhone });
  }
  if (status) update.status = status;
  if (photoPaths) {
    assertOwnPhotos('adoption', id, photoPaths);
    await deleteRemovedPhotos(bucket, (current.photoPaths as string[] | undefined) ?? [], photoPaths);
    update.photoPaths = photoPaths;
  }
  await ref.update(update);
  return { ok: true as const };
}

export async function deleteAdoption(uid: string, data: unknown, { db, bucket }: Deps) {
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !id) invalid();
  const { ref } = await ownedDoc(db, 'adoption_listings', id, 'ownerId', uid);
  await db.recursiveDelete(ref);
  await bucket.deleteFiles({ prefix: `${CENTRAL_STORAGE_ROOT.adoption}/${id}/`, force: true });
  return { ok: true as const };
}

/* ---------------------------------- Resgate ---------------------------------- */

export async function createRescueAlert(uid: string, data: unknown, { db, now }: Deps) {
  const parsed = rescueAlertInputSchema.safeParse(data);
  if (!parsed.success) invalid();
  const ref = db.collection('rescue_alerts').doc();
  await db.runTransaction(async (tx) => {
    await consumeDailyQuota(tx, db, uid, 'rescue', now);
    tx.set(
      ref,
      compact({
        ...parsed.data,
        reporterId: uid,
        status: 'open',
        photoPaths: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
  });
  return { id: ref.id };
}

export async function updateRescueAlert(uid: string, data: unknown, { db, bucket }: Deps) {
  const parsed = rescueAlertUpdateSchema.safeParse(data);
  if (!parsed.success) invalid();
  const { id, status, photoPaths } = parsed.data;
  const { ref, data: current } = await ownedDoc(db, 'rescue_alerts', id, 'reporterId', uid);
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (status) update.status = status;
  if (photoPaths) {
    assertOwnPhotos('rescue', id, photoPaths);
    await deleteRemovedPhotos(bucket, (current.photoPaths as string[] | undefined) ?? [], photoPaths);
    update.photoPaths = photoPaths;
  }
  await ref.update(update);
  return { ok: true as const };
}

export async function deleteRescueAlert(uid: string, data: unknown, { db, bucket }: Deps) {
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !id) invalid();
  const { ref } = await ownedDoc(db, 'rescue_alerts', id, 'reporterId', uid);
  await db.recursiveDelete(ref);
  await bucket.deleteFiles({ prefix: `${CENTRAL_STORAGE_ROOT.rescue}/${id}/`, force: true });
  return { ok: true as const };
}

/* --------------------------------- Denúncia --------------------------------- */

/** Denúncia privada: só quem denunciou lê. Nada do conteúdo vai para o log. */
export async function createReport(uid: string, data: unknown, { db, now }: Deps) {
  const parsed = reportInputSchema.safeParse(data);
  if (!parsed.success) invalid();
  const ref = db.collection('reports').doc();
  await db.runTransaction(async (tx) => {
    await consumeDailyQuota(tx, db, uid, 'report', now);
    tx.set(
      ref,
      compact({
        ...parsed.data,
        reporterId: uid,
        status: 'received',
        photoPaths: [],
        createdAt: FieldValue.serverTimestamp(),
      }),
    );
  });
  return { id: ref.id };
}

/** Anexa as fotos (já enviadas ao Storage) à denúncia. Só quem denunciou, e só fotos da pasta da denúncia. */
export async function attachReportPhotos(uid: string, data: unknown, { db, bucket }: Deps) {
  const parsed = reportPhotosSchema.safeParse(data);
  if (!parsed.success) invalid();
  const { id, photoPaths } = parsed.data;
  const { ref, data: current } = await ownedDoc(db, 'reports', id, 'reporterId', uid);
  assertOwnPhotos('report', id, photoPaths);
  await deleteRemovedPhotos(bucket, (current.photoPaths as string[] | undefined) ?? [], photoPaths);
  await ref.update({ photoPaths });
  return { ok: true as const };
}
