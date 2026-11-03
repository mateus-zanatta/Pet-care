import { type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
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
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'pets/pet1'), validPet('owner'));
    for (const [uid, role] of [['owner', 'owner'], ['carer', 'caregiver'], ['visitor', 'viewer']] as const) {
      await setDoc(doc(fs, `pet_members/pet1_${uid}`), { petId: 'pet1', uid, role, addedAt: new Date() });
    }
    await setDoc(doc(fs, 'pets/pet2'), validPet('other'));
    await setDoc(doc(fs, 'pet_members/pet2_other'), { petId: 'pet2', uid: 'other', role: 'owner', addedAt: new Date() });
  });
});

const db = (uid: string) => env.authenticatedContext(uid, registered).firestore();
const ref = (uid: string, path: string) => doc(db(uid), path);

const vaccine = (createdBy: string, over: Record<string, unknown> = {}) => ({
  name: 'V10',
  appliedOn: '2026-10-01',
  nextDoseOn: '2027-10-01',
  createdBy,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});
const healthEvent = (createdBy: string, over: Record<string, unknown> = {}) => ({
  type: 'deworming',
  date: '2026-10-01',
  title: 'Vermífugo',
  nextDate: '2026-12-01',
  createdBy,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});
const attachment = { id: 'a1', path: 'pets/pet1/attachments/r1/a1.pdf', name: 'exame.pdf', contentType: 'application/pdf', size: 10, addedAt: '2026-11-04T10:00:00.000Z' };

/** As duas coleções têm as mesmas regras de acesso; roda a mesma bateria nas duas. */
describe.each([
  ['vaccines', vaccine],
  ['health_events', healthEvent],
] as const)('%s: quem pode o quê', (collectionName, make) => {
  const path = (id = 'r1', petId = 'pet1') => `pets/${petId}/${collectionName}/${id}`;

  it('dono e cuidador criam; visualizador, estranho e anônimo não', async () => {
    await assertSucceeds(setDoc(ref('owner', path('a')), make('owner')));
    await assertSucceeds(setDoc(ref('carer', path('b')), make('carer')));
    await assertFails(setDoc(ref('visitor', path('c')), make('visitor')));
    await assertFails(setDoc(ref('stranger', path('d')), make('stranger')));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), path('e')), make('x')));
  });

  it('todos os membros leem; estranhos não', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path()), make('owner')));
    for (const uid of ['owner', 'carer', 'visitor']) await assertSucceeds(getDoc(ref(uid, path())));
    await assertFails(getDoc(ref('stranger', path())));
    await assertFails(getDocs(collection(db('stranger'), `pets/pet1/${collectionName}`)));
  });

  it('o autor registrado é a própria pessoa e não vale em outro pet', async () => {
    await assertFails(setDoc(ref('carer', path('x')), make('owner')));
    await assertFails(setDoc(ref('owner', path('x', 'pet2')), make('owner')));
  });

  it('editar e excluir: dono e cuidador sim; visualizador não; autor e criação não mudam', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path()), make('owner')));
    const textField = collectionName === 'vaccines' ? 'notes' : 'description';
    await assertSucceeds(updateDoc(ref('carer', path()), { [textField]: 'ok', updatedAt: new Date() }));
    await assertFails(updateDoc(ref('visitor', path()), { updatedAt: new Date() }));
    await assertFails(updateDoc(ref('carer', path()), { createdBy: 'carer' }));
    await assertFails(updateDoc(ref('carer', path()), { createdAt: new Date('2000-01-01') }));
    await assertFails(deleteDoc(ref('visitor', path())));
    await assertSucceeds(deleteDoc(ref('carer', path())));
  });

  it('anexos: lista de até 10 referências', async () => {
    await assertSucceeds(setDoc(ref('owner', path('a')), make('owner', { attachments: [attachment] })));
    await assertFails(setDoc(ref('owner', path('b')), make('owner', { attachments: Array.from({ length: 11 }, () => attachment) })));
    await assertFails(setDoc(ref('owner', path('c')), make('owner', { attachments: 'pets/pet1/x.pdf' })));
  });

  it('rejeita campo extra, título vazio ou enorme e datas mal formadas', async () => {
    await assertFails(setDoc(ref('owner', path('a')), make('owner', { diagnosis: 'x' })));
    const titleKey = collectionName === 'vaccines' ? 'name' : 'title';
    await assertFails(setDoc(ref('owner', path('b')), make('owner', { [titleKey]: '' })));
    await assertFails(setDoc(ref('owner', path('c')), make('owner', { [titleKey]: 'x'.repeat(81) })));
    const dateKey = collectionName === 'vaccines' ? 'appliedOn' : 'date';
    await assertFails(setDoc(ref('owner', path('d')), make('owner', { [dateKey]: '01/10/2026' })));
    await assertFails(setDoc(ref('owner', path('e')), make('owner', { vet: { name: 'Ana', cpf: '1' } })));
  });
});

describe('health_events: tipos', () => {
  it.each(['consultation', 'deworming', 'flea_tick', 'exam', 'surgery', 'other'])('aceita %s', async (type) => {
    await assertSucceeds(setDoc(ref('owner', `pets/pet1/health_events/${type}`), healthEvent('owner', { type })));
  });
  it('recusa tipo desconhecido', async () => {
    await assertFails(setDoc(ref('owner', 'pets/pet1/health_events/x'), healthEvent('owner', { type: 'magic' })));
  });
});

describe('medications: anexos (foto da receita)', () => {
  const medication = (over: Record<string, unknown> = {}) => ({
    name: 'Amoxicilina',
    dose: { amount: '1', unit: 'ml', route: 'oral' },
    frequency: { kind: 'interval', everyHours: 8 },
    startDate: '2026-11-04',
    status: 'active',
    createdBy: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });
  it('aceita a lista de anexos e preserva ao editar outros campos', async () => {
    await assertSucceeds(setDoc(ref('owner', 'pets/pet1/medications/m1'), medication({ attachments: [attachment] })));
    await assertSucceeds(updateDoc(ref('carer', 'pets/pet1/medications/m1'), { status: 'completed', updatedAt: new Date() }));
    await assertFails(setDoc(ref('owner', 'pets/pet1/medications/m2'), medication({ attachments: Array.from({ length: 11 }, () => attachment) })));
  });
});
