import { type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createEnv, registered, validPet } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'pets/p1'), validPet('alice'));
    await setDoc(doc(fs, 'pet_members/p1_alice'), { petId: 'p1', uid: 'alice', role: 'owner' });
    await setDoc(doc(fs, 'pet_members/p1_carol'), { petId: 'p1', uid: 'carol', role: 'caregiver' });
    await setDoc(doc(fs, 'pet_members/p1_vera'), { petId: 'p1', uid: 'vera', role: 'viewer' });
  });
});

const storage = (uid: string) => env.authenticatedContext(uid, registered).storage();
const jpeg = { contentType: 'image/jpeg' };
const bytes = (n: number) => new Uint8Array(n);

describe('Storage: pets/{petId}/...', () => {
  it('dono e cuidador enviam imagem; visualizador e estranho não', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice'), 'pets/p1/profile.jpg'), bytes(10), jpeg));
    await assertSucceeds(uploadBytes(ref(storage('carol'), 'pets/p1/extra.jpg'), bytes(10), jpeg));
    await assertFails(uploadBytes(ref(storage('vera'), 'pets/p1/x.jpg'), bytes(10), jpeg));
    await assertFails(uploadBytes(ref(storage('bob'), 'pets/p1/x.jpg'), bytes(10), jpeg));
  });

  it('só aceita imagens e limita o tamanho', async () => {
    await assertFails(
      uploadBytes(ref(storage('alice'), 'pets/p1/a.txt'), bytes(10), { contentType: 'text/plain' }),
    );
    await assertFails(
      uploadBytes(ref(storage('alice'), 'pets/p1/big.jpg'), bytes(11 * 1024 * 1024), jpeg),
    );
  });

  it('membros leem; estranhos não', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'pets/p1/profile.jpg'), bytes(10), jpeg);
    });
    await assertSucceeds(getBytes(ref(storage('vera'), 'pets/p1/profile.jpg')));
    await assertFails(getBytes(ref(storage('bob'), 'pets/p1/profile.jpg')));
  });

  it('visualizador não apaga arquivos', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'pets/p1/profile.jpg'), bytes(10), jpeg);
    });
    await assertFails(deleteObject(ref(storage('vera'), 'pets/p1/profile.jpg')));
    await assertSucceeds(deleteObject(ref(storage('alice'), 'pets/p1/profile.jpg')));
  });
});

describe('Storage: pets/{petId}/attachments/... (receitas e exames)', () => {
  const pdf = { contentType: 'application/pdf' };

  it('aceita PDF e imagem de até 10 MB nos anexos; dono e cuidador enviam, visualizador não', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice'), 'pets/p1/attachments/r1/a.pdf'), bytes(10), pdf));
    await assertSucceeds(uploadBytes(ref(storage('carol'), 'pets/p1/attachments/r1/b.jpg'), bytes(10), jpeg));
    await assertFails(uploadBytes(ref(storage('vera'), 'pets/p1/attachments/r1/c.pdf'), bytes(10), pdf));
    await assertFails(uploadBytes(ref(storage('bob'), 'pets/p1/attachments/r1/d.pdf'), bytes(10), pdf));
  });

  it('recusa outros tipos e arquivos acima de 10 MB', async () => {
    await assertFails(uploadBytes(ref(storage('alice'), 'pets/p1/attachments/r1/a.html'), bytes(10), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(storage('alice'), 'pets/p1/attachments/r1/a.zip'), bytes(10), { contentType: 'application/zip' }));
    await assertFails(uploadBytes(ref(storage('alice'), 'pets/p1/attachments/r1/big.pdf'), bytes(11 * 1024 * 1024), pdf));
  });

  it('PDF só vale nos anexos: fora dessa pasta continua só imagem', async () => {
    await assertFails(uploadBytes(ref(storage('alice'), 'pets/p1/profile.pdf'), bytes(10), pdf));
  });

  it('membros (inclusive visualizador) leem; estranhos não; cuidador apaga, visualizador não', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'pets/p1/attachments/r1/a.pdf'), bytes(10), pdf);
    });
    await assertSucceeds(getBytes(ref(storage('vera'), 'pets/p1/attachments/r1/a.pdf')));
    await assertFails(getBytes(ref(storage('bob'), 'pets/p1/attachments/r1/a.pdf')));
    await assertFails(deleteObject(ref(storage('vera'), 'pets/p1/attachments/r1/a.pdf')));
    await assertSucceeds(deleteObject(ref(storage('carol'), 'pets/p1/attachments/r1/a.pdf')));
  });
});

describe('Storage: users/{uid}/... (dados privados)', () => {
  it('só a própria pessoa acessa', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice'), 'users/alice/x.bin'), bytes(5)));
    await assertFails(uploadBytes(ref(storage('bob'), 'users/alice/x.bin'), bytes(5)));
    await assertFails(getBytes(ref(storage('bob'), 'users/alice/x.bin')));
  });
});

describe('Storage: caminhos desconhecidos', () => {
  it('ficam fechados', async () => {
    await assertFails(uploadBytes(ref(storage('alice'), 'qualquer/x.jpg'), bytes(5), jpeg));
  });
});
