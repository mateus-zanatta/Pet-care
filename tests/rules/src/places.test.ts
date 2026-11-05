import { type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anonymous, createEnv, registered } from './helpers';

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

const favorite = (ownerId: string, over: Record<string, unknown> = {}) => ({
  ownerId,
  placeId: 'osm:node/1',
  source: 'osm',
  name: 'Clínica Perto',
  category: 'vet',
  lat: -23.55,
  lng: -46.63,
  emergency: false,
  createdAt: serverTimestamp(),
  ...over,
});

describe('favorite_places', () => {
  it('a própria pessoa (com conta) favorita, lê, lista e remove', async () => {
    const ana = db('ana');
    await assertSucceeds(setDoc(doc(ana, 'favorite_places/ana_osm-node-1'), favorite('ana', { address: 'Rua A, 10', phone: '1133334444', openingHours: '24/7' })));
    await assertSucceeds(getDoc(doc(ana, 'favorite_places/ana_osm-node-1')));
    await assertSucceeds(getDocs(query(collection(ana, 'favorite_places'), where('ownerId', '==', 'ana'))));
    await assertSucceeds(deleteDoc(doc(ana, 'favorite_places/ana_osm-node-1')));
  });

  it('ninguém vê, lista ou apaga os favoritos de outra pessoa', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'favorite_places/ana_osm-node-1'), { ...favorite('ana'), createdAt: new Date() }));
    const bia = db('bia');
    await assertFails(getDoc(doc(bia, 'favorite_places/ana_osm-node-1')));
    await assertFails(getDocs(query(collection(bia, 'favorite_places'), where('ownerId', '==', 'ana'))));
    await assertFails(deleteDoc(doc(bia, 'favorite_places/ana_osm-node-1')));
  });

  it('não dá para gravar em nome de outra pessoa nem com ID de outra pessoa', async () => {
    await assertFails(setDoc(doc(db('bia'), 'favorite_places/bia_osm-node-1'), favorite('ana')));
    await assertFails(setDoc(doc(db('bia'), 'favorite_places/ana_osm-node-1'), favorite('bia')));
  });

  it('conta anônima não favorita; visitante sem login não acessa', async () => {
    await assertFails(setDoc(doc(db('anon', anonymous), 'favorite_places/anon_osm-node-1'), favorite('anon')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'favorite_places')));
  });

  it('rejeita campos extras, tipo desconhecido, coordenadas inválidas e textos enormes', async () => {
    const ana = db('ana');
    const id = 'favorite_places/ana_osm-node-1';
    await assertFails(setDoc(doc(ana, id), favorite('ana', { note: 'x' })));
    await assertFails(setDoc(doc(ana, id), favorite('ana', { category: 'zoo' })));
    await assertFails(setDoc(doc(ana, id), favorite('ana', { lat: 120 })));
    await assertFails(setDoc(doc(ana, id), favorite('ana', { name: 'x'.repeat(121) })));
    await assertFails(setDoc(doc(ana, id), favorite('ana', { emergency: 'sim' })));
    await assertFails(setDoc(doc(ana, id), favorite('ana', { createdAt: 'ontem' })));
  });
});

describe('coleções só do servidor', () => {
  it.each(['places_cache/osm_v1_-23.55_-46.63_5', 'place_suggestions/s1', 'suggestion_quota/ana_2026-11-04'])('%s: ninguém do app lê nem escreve', async (path) => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), { x: 1 }));
    await assertFails(getDoc(doc(db('ana'), path)));
    await assertFails(setDoc(doc(db('ana'), path), { x: 2 }));
    await assertFails(deleteDoc(doc(db('ana'), path)));
  });
});
