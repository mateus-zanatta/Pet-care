import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Testa as funções do jeito que o app as chama: HTTP callable no emulador de Functions,
 * com o token de login do emulador de Auth. Rode com `npm run test:emulators` (na raiz).
 */
const PROJECT = 'demo-petcare';
const REGION = 'southamerica-east1';
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

beforeAll(() => {
  if (getApps().length === 0) initializeApp({ projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com` });
});

beforeEach(async () => {
  const db = getFirestore();
  await Promise.all((await db.listCollections()).map((c) => db.recursiveDelete(c)));
  const { users } = await getAuth().listUsers();
  if (users.length) await getAuth().deleteUsers(users.map((u) => u.uid));
});

async function signUp(email: string): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha1234', returnSecureToken: true }),
  });
  const body = (await res.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

async function signUpAnonymous(): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const body = (await res.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

async function call(name: string, idToken: string | null, data: unknown = {}) {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(idToken ? { authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as { result?: unknown; error?: { status: string; message: string } };
}

/** Token "antigo": a função precisa recusar ações sensíveis sem login recente. */
function unsignedToken(uid: string, authTimeSecondsAgo: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: uid,
    user_id: uid,
    iat: now,
    exp: now + 3600,
    auth_time: now - authTimeSecondsAgo,
    firebase: { sign_in_provider: 'password', identities: {} },
  })}.`;
}

describe('deleteAccount (callable)', () => {
  it('recusa quem não está logado', async () => {
    const res = await call('deleteAccount', null);
    expect(res.error?.status).toBe('UNAUTHENTICATED');
  });

  it('apaga a conta e os dados de quem acabou de entrar', async () => {
    const { uid, idToken } = await signUp('ana@exemplo.com');
    await getFirestore().doc(`users/${uid}`).set({ locale: 'pt-BR' });
    await getFirestore().doc(`pets/p1`).set({ ownerId: uid, name: 'Mel' });
    await getFirestore().doc(`pet_members/p1_${uid}`).set({ petId: 'p1', uid, role: 'owner' });

    const res = await call('deleteAccount', idToken);

    expect(res.result).toEqual({ ok: true });
    expect((await getFirestore().doc(`users/${uid}`).get()).exists).toBe(false);
    expect((await getFirestore().doc('pets/p1').get()).exists).toBe(false);
    await expect(getAuth().getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });

  it('exige login recente de contas com senha (token de 1 hora atrás é recusado)', async () => {
    const { uid } = await signUp('bia@exemplo.com');
    const res = await call('deleteAccount', unsignedToken(uid, 3600));
    expect(res.error?.status).toBe('FAILED_PRECONDITION');
    expect((await getAuth().getUser(uid)).uid).toBe(uid); // nada foi apagado
  });

  it('conta anônima (sem senha para reconfirmar) pode excluir direto', async () => {
    const { uid, idToken } = await signUpAnonymous();
    const res = await call('deleteAccount', idToken);
    expect(res.result).toEqual({ ok: true });
    await expect(getAuth().getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });
});

describe('deletePet (callable)', () => {
  it('só o dono apaga; cuidador e estranho são recusados', async () => {
    const owner = await signUp('dono@exemplo.com');
    const carer = await signUp('cuidador@exemplo.com');
    const stranger = await signUp('estranho@exemplo.com');
    const db = getFirestore();
    await db.doc('pets/p1').set({ ownerId: owner.uid, name: 'Mel' });
    await db.doc(`pet_members/p1_${owner.uid}`).set({ petId: 'p1', uid: owner.uid, role: 'owner' });
    await db.doc(`pet_members/p1_${carer.uid}`).set({ petId: 'p1', uid: carer.uid, role: 'caregiver' });

    expect((await call('deletePet', carer.idToken, { petId: 'p1' })).error?.status).toBe('PERMISSION_DENIED');
    expect((await call('deletePet', stranger.idToken, { petId: 'p1' })).error?.status).toBe('PERMISSION_DENIED');
    expect((await db.doc('pets/p1').get()).exists).toBe(true);

    expect((await call('deletePet', owner.idToken, { petId: 'p1' })).result).toEqual({ ok: true });
    expect((await db.doc('pets/p1').get()).exists).toBe(false);
    expect((await db.doc(`pet_members/p1_${carer.uid}`).get()).exists).toBe(false);
  });

  it('valida a entrada e exige login', async () => {
    const { idToken } = await signUp('ana@exemplo.com');
    expect((await call('deletePet', idToken, {})).error?.status).toBe('INVALID_ARGUMENT');
    expect((await call('deletePet', null, { petId: 'p1' })).error?.status).toBe('UNAUTHENTICATED');
  });
});
