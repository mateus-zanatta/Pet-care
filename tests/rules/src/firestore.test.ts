import { type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anonymous, createEnv, registered, validPet } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const db = (uid: string, token = registered) => env.authenticatedContext(uid, token).firestore();

/** Semeia um pet com dono e outros membros, ignorando as regras. */
async function seedPet(petId: string, ownerId: string, members: Record<string, string> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'pets', petId), validPet(ownerId));
    await setDoc(doc(fs, 'pet_members', `${petId}_${ownerId}`), {
      petId, uid: ownerId, role: 'owner', addedAt: new Date(),
    });
    for (const [uid, role] of Object.entries(members)) {
      await setDoc(doc(fs, 'pet_members', `${petId}_${uid}`), { petId, uid, role, addedAt: new Date() });
    }
  });
}

describe('users/{uid}', () => {
  const userDoc = { locale: 'pt-BR', isAnonymous: false, createdAt: new Date(), updatedAt: new Date() };

  it('o próprio usuário cria e lê o seu documento', async () => {
    const alice = db('alice');
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), userDoc));
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
  });

  it('outra pessoa não lê nem escreve', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), userDoc));
    const bob = db('bob');
    await assertFails(getDoc(doc(bob, 'users/alice')));
    await assertFails(setDoc(doc(bob, 'users/alice'), userDoc));
  });

  it('visitante sem login não acessa', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice')));
  });

  it('rejeita idioma inválido e campos extras (ex.: tentar se dar plano premium)', async () => {
    const alice = db('alice');
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...userDoc, locale: 'xx' }));
    await assertFails(setDoc(doc(alice, 'users/alice'), { ...userDoc, plan: 'premium' }));
  });

  it('não permite apagar pelo cliente', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/alice'), userDoc));
    await assertFails(deleteDoc(doc(db('alice'), 'users/alice')));
  });
});

describe('entitlements/{uid}', () => {
  it('a pessoa lê o próprio plano, mas nunca escreve', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'entitlements/alice'), { premium: false }),
    );
    const alice = db('alice');
    await assertSucceeds(getDoc(doc(alice, 'entitlements/alice')));
    await assertFails(setDoc(doc(alice, 'entitlements/alice'), { premium: true }));
    await assertFails(getDoc(doc(db('bob'), 'entitlements/alice')));
  });
});

describe('pets: criação', () => {
  const createPet = (fs: ReturnType<typeof db>, uid: string, petId = 'p1', pet = validPet(uid)) => {
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'pets', petId), pet);
    batch.set(doc(fs, 'pet_members', `${petId}_${uid}`), {
      petId, uid, role: 'owner', addedAt: new Date(),
    });
    return batch.commit();
  };

  it('conta registrada cria o pet junto com o vínculo de dono', async () => {
    await assertSucceeds(createPet(db('alice'), 'alice'));
  });

  it('conta anônima não cria pets', async () => {
    await assertFails(createPet(db('anon', anonymous), 'anon'));
  });

  it('não cria pet em nome de outra pessoa', async () => {
    await assertFails(createPet(db('alice'), 'alice', 'p1', validPet('bob')));
  });

  it('não cria o pet sem o vínculo de dono no mesmo lote', async () => {
    await assertFails(setDoc(doc(db('alice'), 'pets/p1'), validPet('alice')));
  });

  it('não cria o vínculo de dono sem criar o pet', async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'pet_members/p1_alice'), {
        petId: 'p1', uid: 'alice', role: 'owner', addedAt: new Date(),
      }),
    );
  });

  it('não se torna dono do pet de outra pessoa', async () => {
    await seedPet('p1', 'alice');
    await assertFails(
      setDoc(doc(db('bob'), 'pet_members/p1_bob'), {
        petId: 'p1', uid: 'bob', role: 'owner', addedAt: new Date(),
      }),
    );
  });

  it('rejeita dados inválidos: espécie, nome longo, campo extra, peso', async () => {
    const alice = db('alice');
    await assertFails(createPet(alice, 'alice', 'p1', validPet('alice', { species: 'dragon' })));
    await assertFails(createPet(alice, 'alice', 'p2', validPet('alice', { name: 'x'.repeat(61) })));
    await assertFails(createPet(alice, 'alice', 'p3', validPet('alice', { isPremium: true })));
    await assertFails(createPet(alice, 'alice', 'p4', validPet('alice', { weightKg: -1 })));
    await assertFails(createPet(alice, 'alice', 'p5', validPet('alice', { origin: 'admin' })));
  });
});

describe('pets: dados da importação do RG Animal', () => {
  const rgaPet = (uid: string, overrides: Record<string, unknown> = {}) =>
    validPet(uid, {
      origin: 'rga_import',
      rga: 'ABC.1D23.C-SP',
      sinpatinhas: { importadoEm: '2026-11-03T12:00:00.000Z', origem: 'pdf', emitidoEm: '2026-10-01', qrConfere: true },
      ...overrides,
    });
  const createWith = (uid: string, petId: string, pet: Record<string, unknown>) => {
    const fs = db(uid);
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'pets', petId), pet);
    batch.set(doc(fs, 'pet_members', `${petId}_${uid}`), { petId, uid, role: 'owner', addedAt: new Date() });
    return batch.commit();
  };

  it('aceita pet importado, com os dados do SinPatinhas e (se a pessoa confirmou) o responsável', async () => {
    await assertSucceeds(createWith('alice', 'r1', rgaPet('alice')));
    await assertSucceeds(
      createWith('alice', 'r2', rgaPet('alice', { tutor: { nome: 'Fulano', telefone: '19987654321' } })),
    );
  });

  it('o dono atualiza os dados do SinPatinhas (ex.: ao reimportar)', async () => {
    await assertSucceeds(createWith('alice', 'r1', rgaPet('alice')));
    await assertSucceeds(
      updateDoc(doc(db('alice'), 'pets/r1'), {
        sinpatinhas: { importadoEm: '2026-11-04T09:00:00.000Z', origem: 'pdf', qrConfere: false },
      }),
    );
  });

  it('PRIVACIDADE: não existe como gravar CPF/CNPJ (campo recusado nas regras)', async () => {
    await assertFails(createWith('alice', 'r1', rgaPet('alice', { cpf: '12345678909' })));
    await assertFails(createWith('alice', 'r2', rgaPet('alice', { cnpj: '12345678000199' })));
    await createWith('alice', 'r3', rgaPet('alice'));
    await assertFails(updateDoc(doc(db('alice'), 'pets/r3'), { cpf: '12345678909' }));
  });
});

describe('pets: leitura e edição por papel', () => {
  beforeEach(async () => {
    await seedPet('p1', 'alice', { carol: 'caregiver', vera: 'viewer' });
  });

  it('membros leem; quem não é membro não lê', async () => {
    await assertSucceeds(getDoc(doc(db('alice'), 'pets/p1')));
    await assertSucceeds(getDoc(doc(db('carol'), 'pets/p1')));
    await assertSucceeds(getDoc(doc(db('vera'), 'pets/p1')));
    await assertFails(getDoc(doc(db('bob'), 'pets/p1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'pets/p1')));
  });

  it('dono e cuidador editam; visualizador e estranho não', async () => {
    await assertSucceeds(updateDoc(doc(db('alice'), 'pets/p1'), { name: 'Mel 2' }));
    await assertSucceeds(updateDoc(doc(db('carol'), 'pets/p1'), { weightKg: 4.2 }));
    await assertFails(updateDoc(doc(db('vera'), 'pets/p1'), { name: 'X' }));
    await assertFails(updateDoc(doc(db('bob'), 'pets/p1'), { name: 'X' }));
  });

  it('ninguém troca o dono nem a origem do pet', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'pets/p1'), { ownerId: 'bob' }));
    await assertFails(updateDoc(doc(db('alice'), 'pets/p1'), { origin: 'rescue' }));
  });

  it('o cliente nunca apaga o pet (só a Cloud Function)', async () => {
    await assertFails(deleteDoc(doc(db('alice'), 'pets/p1')));
  });
});

describe('pet_members', () => {
  beforeEach(async () => {
    await seedPet('p1', 'alice', { carol: 'caregiver' });
    await seedPet('p2', 'bob');
  });

  it('a pessoa lista as próprias participações', async () => {
    const q = query(collection(db('carol'), 'pet_members'), where('uid', '==', 'carol'));
    await assertSucceeds(getDocs(q));
  });

  it('não lista as participações de outra pessoa', async () => {
    const q = query(collection(db('carol'), 'pet_members'), where('uid', '==', 'alice'));
    await assertFails(getDocs(q));
  });

  it('o dono vê um vínculo do seu pet; outro membro, não', async () => {
    await assertSucceeds(getDoc(doc(db('alice'), 'pet_members/p1_carol')));
    await assertFails(getDoc(doc(db('bob'), 'pet_members/p1_carol')));
  });

  it('ninguém se autopromove, edita ou remove vínculos pelo cliente', async () => {
    await assertFails(updateDoc(doc(db('carol'), 'pet_members/p1_carol'), { role: 'owner' }));
    await assertFails(deleteDoc(doc(db('carol'), 'pet_members/p1_carol')));
    await assertFails(
      setDoc(doc(db('alice'), 'pet_members/p1_dave'), {
        petId: 'p1', uid: 'dave', role: 'caregiver', addedAt: new Date(),
      }),
    );
  });
});

describe('o que não está nas regras é negado', () => {
  it('coleções desconhecidas ficam fechadas', async () => {
    await assertFails(setDoc(doc(db('alice'), 'qualquer_coisa/x'), { a: 1 }));
    await assertFails(getDoc(doc(db('alice'), 'report_channels/br')));
  });
});
