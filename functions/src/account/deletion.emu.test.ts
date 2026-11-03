import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteAccountCascade, deletePetCascade } from './deletion';

beforeAll(() => {
  if (getApps().length === 0) {
    initializeApp({ projectId: 'demo-petcare', storageBucket: 'demo-petcare.appspot.com' });
  }
});

const db = () => getFirestore();
const auth = () => getAuth();
const bucket = () => getStorage().bucket();
const deps = () => ({ db: db(), auth: auth(), bucket: bucket() });

const exists = async (path: string) => (await db().doc(path).get()).exists;
const fileExists = async (path: string) => (await bucket().file(path).exists())[0];
const save = (path: string) => bucket().file(path).save(Buffer.from('x'));

async function seedPet(petId: string, ownerId: string, others: Record<string, string> = {}) {
  await db().doc(`pets/${petId}`).set({ ownerId, name: 'Pet', origin: 'manual' });
  await db().doc(`pets/${petId}/medications/m1`).set({ name: 'Remédio' });
  await db().doc(`pets/${petId}/dose_logs/d1`).set({ medicationId: 'm1' });
  await db().doc(`pet_members/${petId}_${ownerId}`).set({ petId, uid: ownerId, role: 'owner' });
  for (const [uid, role] of Object.entries(others)) {
    await db().doc(`pet_members/${petId}_${uid}`).set({ petId, uid, role });
  }
  await save(`pets/${petId}/profile.jpg`);
}

beforeEach(async () => {
  // Limpa tudo entre os testes (emuladores).
  const collections = await db().listCollections();
  await Promise.all(collections.map((c) => db().recursiveDelete(c)));
  const [files] = await bucket().getFiles();
  await Promise.all(files.map((f) => f.delete()));
  const { users } = await auth().listUsers();
  if (users.length) await auth().deleteUsers(users.map((u) => u.uid));
});

describe('deleteAccountCascade', () => {
  async function seedWorld() {
    for (const uid of ['alice', 'bob', 'carol']) await auth().createUser({ uid });
    await seedPet('p1', 'alice', { bob: 'caregiver' });
    await seedPet('p2', 'alice');
    await seedPet('p3', 'carol');
    await db().doc('users/alice').set({ locale: 'pt-BR' });
    await db().doc('users/bob').set({ locale: 'en' });
    await db().doc('entitlements/alice').set({ premium: true });
    await db().doc('favorite_places/f1').set({ ownerId: 'alice' });
    await db().doc('reports/r1').set({ ownerId: 'alice' });
    await db().doc('reports/r1/media/m1').set({ sha256: 'abc' });
    await db().doc('reports/r2').set({ ownerId: 'carol' });
    await save('users/alice/report.jpg');
    await save('users/carol/report.jpg');
  }

  it('apaga TUDO da pessoa e a conta de login, sem tocar nos dados dos outros', async () => {
    await seedWorld();

    const summary = await deleteAccountCascade(deps(), 'alice');
    expect(summary).toEqual({ pets: 2, memberships: 0 });

    // Pets da Alice, com subcoleções, vínculos e arquivos
    for (const path of [
      'pets/p1', 'pets/p1/medications/m1', 'pets/p1/dose_logs/d1',
      'pets/p2', 'pets/p2/medications/m1',
      'pet_members/p1_alice', 'pet_members/p1_bob', 'pet_members/p2_alice',
    ]) {
      expect(await exists(path), path).toBe(false);
    }
    expect(await fileExists('pets/p1/profile.jpg')).toBe(false);
    expect(await fileExists('pets/p2/profile.jpg')).toBe(false);

    // Dados pessoais
    for (const path of ['users/alice', 'entitlements/alice', 'favorite_places/f1', 'reports/r1', 'reports/r1/media/m1']) {
      expect(await exists(path), path).toBe(false);
    }
    expect(await fileExists('users/alice/report.jpg')).toBe(false);
    await expect(auth().getUser('alice')).rejects.toMatchObject({ code: 'auth/user-not-found' });

    // Dados dos outros continuam intactos
    for (const path of ['pets/p3', 'pets/p3/medications/m1', 'pet_members/p3_carol', 'users/bob', 'reports/r2']) {
      expect(await exists(path), path).toBe(true);
    }
    expect(await fileExists('pets/p3/profile.jpg')).toBe(true);
    expect(await fileExists('users/carol/report.jpg')).toBe(true);
    expect((await auth().getUser('bob')).uid).toBe('bob');
  });

  it('um membro que não é dono só perde o próprio vínculo; o pet continua', async () => {
    await seedWorld();

    const summary = await deleteAccountCascade(deps(), 'bob');
    expect(summary).toEqual({ pets: 0, memberships: 1 });

    expect(await exists('pet_members/p1_bob')).toBe(false);
    expect(await exists('users/bob')).toBe(false);
    expect(await exists('pets/p1')).toBe(true);
    expect(await exists('pets/p1/medications/m1')).toBe(true);
    expect(await exists('pet_members/p1_alice')).toBe(true);
    expect(await fileExists('pets/p1/profile.jpg')).toBe(true);
  });

  it('é idempotente: rodar de novo (ou para quem já não existe) não falha', async () => {
    await seedWorld();
    await deleteAccountCascade(deps(), 'alice');
    await expect(deleteAccountCascade(deps(), 'alice')).resolves.toEqual({ pets: 0, memberships: 0 });
  });
});

describe('deletePetCascade', () => {
  it('apaga só o pet indicado', async () => {
    await seedPet('p1', 'alice', { bob: 'viewer' });
    await seedPet('p2', 'alice');

    await deletePetCascade(deps(), 'p1');

    expect(await exists('pets/p1')).toBe(false);
    expect(await exists('pets/p1/dose_logs/d1')).toBe(false);
    expect(await exists('pet_members/p1_bob')).toBe(false);
    expect(await fileExists('pets/p1/profile.jpg')).toBe(false);
    expect(await exists('pets/p2')).toBe(true);
    expect(await exists('pet_members/p2_alice')).toBe(true);
  });
});
