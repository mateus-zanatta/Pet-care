import type { Bucket } from '@google-cloud/storage';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Coleções de primeiro nível em que cada documento pertence a uma pessoa (`field` = uid).
 * Novas fases acrescentam aqui o que passarem a gravar; a exclusão da conta já cobre.
 */
export const OWNED_COLLECTIONS: ReadonlyArray<{ name: string; field: string }> = [
  { name: 'favorite_places', field: 'ownerId' },
  { name: 'place_suggestions', field: 'createdBy' },
  { name: 'suggestion_quota', field: 'uid' },
  { name: 'rescues', field: 'ownerId' },
  { name: 'reports', field: 'ownerId' },
];

export interface DeletionDeps {
  db: Firestore;
  bucket: Bucket;
  auth: Auth;
}

export type DeletionSummary = { pets: number; memberships: number };

/** Apaga um pet por completo: documento, subcoleções, vínculos de todos os membros e arquivos. */
export async function deletePetCascade(
  { db, bucket }: Pick<DeletionDeps, 'db' | 'bucket'>,
  petId: string,
): Promise<void> {
  const members = await db.collection('pet_members').where('petId', '==', petId).get();
  await db.recursiveDelete(db.collection('pets').doc(petId));
  await Promise.all(members.docs.map((m) => m.ref.delete()));
  await bucket.deleteFiles({ prefix: `pets/${petId}/`, force: true });
}

/**
 * Apaga todos os dados da pessoa e, por último, a própria conta.
 * É idempotente: se algo falhar no meio, chamar de novo termina o serviço
 * (a conta só some no final).
 */
export async function deleteAccountCascade(
  deps: DeletionDeps,
  uid: string,
): Promise<DeletionSummary> {
  const { db, bucket, auth } = deps;
  const summary: DeletionSummary = { pets: 0, memberships: 0 };

  // 1) Pets: os que a pessoa é dona somem inteiros; nos demais, só o vínculo dela.
  const memberships = await db.collection('pet_members').where('uid', '==', uid).get();
  for (const membership of memberships.docs) {
    const { petId, role } = membership.data() as { petId: string; role: string };
    if (role === 'owner') {
      await deletePetCascade(deps, petId);
      summary.pets += 1;
    } else {
      await membership.ref.delete();
      summary.memberships += 1;
    }
  }

  // 2) Dados pessoais em outras coleções (favoritos, resgates, denúncias...).
  for (const { name, field } of OWNED_COLLECTIONS) {
    const owned = await db.collection(name).where(field, '==', uid).get();
    await Promise.all(owned.docs.map((d) => db.recursiveDelete(d.ref)));
  }

  // 3) Perfil, plano e arquivos privados.
  await db.recursiveDelete(db.collection('users').doc(uid));
  await db.recursiveDelete(db.collection('entitlements').doc(uid));
  await bucket.deleteFiles({ prefix: `users/${uid}/`, force: true });

  // 4) Por último, a conta de login.
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }

  return summary;
}
