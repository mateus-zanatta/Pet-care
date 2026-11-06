import { type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
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
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'adoption_listings/a1'), { ownerId: 'ana', status: 'available', species: 'dog' });
    await setDoc(doc(fs, 'adoption_listings/a1/private/contact'), { ownerId: 'ana', contactPhone: '11999990000' });
    await setDoc(doc(fs, 'rescue_alerts/r1'), { reporterId: 'ana', status: 'open', lat: -23.5, lng: -46.6 });
    await setDoc(doc(fs, 'reports/d1'), { reporterId: 'ana', status: 'received' });
    await setDoc(doc(fs, 'rate_limits/ana_report_2026-11-06'), { uid: 'ana', count: 1 });
  });
});

const fs = (uid: string, token = registered) => env.authenticatedContext(uid, token).firestore();
const st = (uid: string, token = registered) => env.authenticatedContext(uid, token).storage();
const jpeg = { contentType: 'image/jpeg' };
const bytes = (n: number) => new Uint8Array(n);

describe('adoção', () => {
  it('qualquer pessoa logada vê os anúncios, até sem cadastro; deslogado não', async () => {
    await assertSucceeds(getDoc(doc(fs('bia'), 'adoption_listings/a1')));
    await assertSucceeds(getDoc(doc(fs('anon', anonymous), 'adoption_listings/a1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'adoption_listings/a1')));
  });

  it('o telefone de contato só aparece para quem tem conta', async () => {
    await assertSucceeds(getDoc(doc(fs('bia'), 'adoption_listings/a1/private/contact')));
    await assertFails(getDoc(doc(fs('anon', anonymous), 'adoption_listings/a1/private/contact')));
  });

  it('ninguém grava direto (nem a dona): tudo passa pela Cloud Function', async () => {
    await assertFails(setDoc(doc(fs('ana'), 'adoption_listings/a1'), { ownerId: 'ana', status: 'adopted' }));
    await assertFails(setDoc(doc(fs('ana'), 'adoption_listings/novo'), { ownerId: 'ana' }));
  });

  it('fotos: a dona envia .jpg; outra pessoa, anônimo, outro formato ou nome estranho, não', async () => {
    await assertSucceeds(uploadBytes(ref(st('ana'), 'adoptions/a1/photo-1.jpg'), bytes(10), jpeg));
    await assertSucceeds(getBytes(ref(st('anon', anonymous), 'adoptions/a1/photo-1.jpg')));
    await assertFails(uploadBytes(ref(st('bia'), 'adoptions/a1/photo-2.jpg'), bytes(10), jpeg));
    await assertFails(uploadBytes(ref(st('ana', anonymous), 'adoptions/a1/photo-2.jpg'), bytes(10), jpeg));
    await assertFails(uploadBytes(ref(st('ana'), 'adoptions/a1/photo.png'), bytes(10), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(st('ana'), 'adoptions/a1/big.jpg'), bytes(9 * 1024 * 1024), jpeg));
    await assertFails(deleteObject(ref(st('bia'), 'adoptions/a1/photo-1.jpg')));
    await assertSucceeds(deleteObject(ref(st('ana'), 'adoptions/a1/photo-1.jpg')));
  });
});

describe('resgate', () => {
  it('só quem tem conta vê os alertas (o ponto é exato)', async () => {
    await assertSucceeds(getDoc(doc(fs('bia'), 'rescue_alerts/r1')));
    await assertSucceeds(getDocs(query(collection(fs('bia'), 'rescue_alerts'), where('status', '==', 'open'))));
    await assertFails(getDoc(doc(fs('anon', anonymous), 'rescue_alerts/r1')));
    await assertFails(setDoc(doc(fs('ana'), 'rescue_alerts/r1'), { reporterId: 'ana', status: 'rescued' }));
  });

  it('fotos do alerta: quem anunciou envia; quem tem conta vê', async () => {
    await assertSucceeds(uploadBytes(ref(st('ana'), 'rescues/r1/photo-1.jpg'), bytes(10), jpeg));
    await assertSucceeds(getBytes(ref(st('bia'), 'rescues/r1/photo-1.jpg')));
    await assertFails(getBytes(ref(st('anon', anonymous), 'rescues/r1/photo-1.jpg')));
    await assertFails(uploadBytes(ref(st('bia'), 'rescues/r1/photo-2.jpg'), bytes(10), jpeg));
  });
});

describe('denúncia', () => {
  it('é privada: só quem denunciou lê; ninguém grava direto', async () => {
    await assertSucceeds(getDoc(doc(fs('ana'), 'reports/d1')));
    await assertSucceeds(getDocs(query(collection(fs('ana'), 'reports'), where('reporterId', '==', 'ana'))));
    await assertFails(getDoc(doc(fs('bia'), 'reports/d1')));
    await assertFails(getDocs(query(collection(fs('bia'), 'reports'), where('reporterId', '==', 'ana'))));
    await assertFails(setDoc(doc(fs('ana'), 'reports/d2'), { reporterId: 'ana' }));
  });

  it('provas (fotos) também são privadas', async () => {
    await assertSucceeds(uploadBytes(ref(st('ana'), 'reports/d1/photo-1.jpg'), bytes(10), jpeg));
    await assertSucceeds(getBytes(ref(st('ana'), 'reports/d1/photo-1.jpg')));
    await assertFails(getBytes(ref(st('bia'), 'reports/d1/photo-1.jpg')));
    await assertFails(uploadBytes(ref(st('bia'), 'reports/d1/photo-2.jpg'), bytes(10), jpeg));
  });

  it('limites diários são só do servidor', async () => {
    await assertFails(getDoc(doc(fs('ana'), 'rate_limits/ana_report_2026-11-06')));
    await assertFails(setDoc(doc(fs('ana'), 'rate_limits/ana_report_2026-11-06'), { count: 0 }));
  });
});
