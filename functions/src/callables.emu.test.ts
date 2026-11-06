import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSyntheticRgaPdf } from './rga/testing/syntheticPdf';

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

describe('importRga (callable)', () => {
  const pdfBase64 = async () => Buffer.from(await buildSyntheticRgaPdf()).toString('base64');

  it('exige login e conta de verdade (anônimo não importa)', async () => {
    const file = { fileBase64: await pdfBase64(), mimeType: 'application/pdf' };
    expect((await call('importRga', null, file)).error?.status).toBe('UNAUTHENTICATED');
    const anonymous = await signUpAnonymous();
    expect((await call('importRga', anonymous.idToken, file)).error?.status).toBe('PERMISSION_DENIED');
  });

  it('recusa pedido malformado (tipo não aceito, arquivo vazio)', async () => {
    const { idToken } = await signUp('ana@exemplo.com');
    expect((await call('importRga', idToken, { fileBase64: await pdfBase64(), mimeType: 'text/html' })).error?.status).toBe(
      'INVALID_ARGUMENT',
    );
    expect((await call('importRga', idToken, {})).error?.status).toBe('INVALID_ARGUMENT');
  });

  it('lê o RG Animal fictício enviado direto na chamada e NÃO devolve o CPF', async () => {
    const { idToken } = await signUp('ana@exemplo.com');
    const response = await call('importRga', idToken, { fileBase64: await pdfBase64(), mimeType: 'application/pdf' });
    const result = response.result as { recognized: boolean; fields: { name: string; species: string }; qr: { matches: boolean }; photoJpegBase64?: string };

    expect(result.recognized).toBe(true);
    expect(result.fields).toMatchObject({ name: 'REX DE TESTE', species: 'dog' });
    expect(result.qr.matches).toBe(true);
    expect(result.photoJpegBase64).toBeTruthy();
    expect(JSON.stringify(response)).not.toContain('123.456.789-09');
    expect(JSON.stringify(response)).not.toContain('12345678909');
  });

  it('arquivo estranho vira "não reconheci", e não erro do servidor', async () => {
    const { idToken } = await signUp('ana@exemplo.com');
    const response = await call('importRga', idToken, {
      fileBase64: Buffer.from('nada a ver com PDF').toString('base64'),
      mimeType: 'application/pdf',
    });
    expect(response.result).toMatchObject({ recognized: false, reason: 'not_a_pdf' });
  });
});

describe('searchPlaces (callable)', () => {
  const cachedPlaces = [
    { id: 'osm:node/1', source: 'osm', name: 'Clínica do Cache', category: 'vet', lat: -23.551, lng: -46.631, emergency: false },
  ];

  async function seedCache() {
    await getFirestore().doc('places_cache/osm_v1_-23.55_-46.63_5').set({
      places: cachedPlaces,
      provider: 'osm',
      fetchedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86_400_000),
    });
  }

  it('exige login, mas aceita quem está SEM cadastro (anônimo): Perto de mim é aberto', async () => {
    await seedCache();
    expect((await call('searchPlaces', null, { lat: -23.55, lng: -46.63, radiusKm: 5 })).error?.status).toBe('UNAUTHENTICATED');
    const anonymous = await signUpAnonymous();
    const res = await call('searchPlaces', anonymous.idToken, { lat: -23.5512, lng: -46.6301, radiusKm: 5 });
    expect(res.result).toEqual({ places: cachedPlaces, provider: 'osm', cached: true });
  });

  it('valida a entrada', async () => {
    const { idToken } = await signUp('ana@exemplo.com');
    expect((await call('searchPlaces', idToken, { lat: -23.55, lng: -46.63, radiusKm: 7 })).error?.status).toBe('INVALID_ARGUMENT');
    expect((await call('searchPlaces', idToken, { lat: 'x' })).error?.status).toBe('INVALID_ARGUMENT');
  });
});

describe('suggestPlace (callable)', () => {
  const suggestion = { kind: 'new', name: 'Clínica Nova', category: 'vet', address: 'Rua B, 20', is24h: false };

  it('exige conta de verdade (anônimo não sugere) e valida a entrada', async () => {
    expect((await call('suggestPlace', null, suggestion)).error?.status).toBe('UNAUTHENTICATED');
    const anonymous = await signUpAnonymous();
    expect((await call('suggestPlace', anonymous.idToken, suggestion)).error?.status).toBe('PERMISSION_DENIED');
    const { idToken } = await signUp('ana@exemplo.com');
    expect((await call('suggestPlace', idToken, { ...suggestion, name: '' })).error?.status).toBe('INVALID_ARGUMENT');
    expect((await call('suggestPlace', idToken, { ...suggestion, kind: 'fix' })).error?.status).toBe('INVALID_ARGUMENT');
  });

  it('grava a sugestão como pendente de moderação, com o autor', async () => {
    const { uid, idToken } = await signUp('ana@exemplo.com');
    const res = (await call('suggestPlace', idToken, suggestion)) as { result?: { ok: boolean; id: string } };
    expect(res.result?.ok).toBe(true);
    const doc = await getFirestore().doc(`place_suggestions/${res.result!.id}`).get();
    expect(doc.data()).toMatchObject({ ...suggestion, createdBy: uid, status: 'pending' });
  });

  it('limita a 10 sugestões por dia por pessoa', async () => {
    const { idToken } = await signUp('ana@exemplo.com');
    for (let i = 0; i < 10; i += 1) {
      expect((await call('suggestPlace', idToken, { ...suggestion, name: `Local ${i}` })).error).toBeUndefined();
    }
    expect((await call('suggestPlace', idToken, suggestion)).error?.status).toBe('RESOURCE_EXHAUSTED');
  });
});

describe('centrais: adoção, resgate e denúncia (callables)', () => {
  const adoption = {
    species: 'dog',
    sex: 'female',
    ageGroup: 'adult',
    colors: ['caramelo'],
    neutered: 'yes',
    vaccines: [{ name: 'V10', date: '2026-05-10' }],
    medications: [],
    exams: [{ name: 'Leishmaniose', note: 'negativo' }],
    description: 'Muito dócil, se dá bem com crianças.',
    city: 'Campinas',
    uf: 'SP',
    lat: -22.907123,
    lng: -47.062987,
    contactPhone: '(19) 99999-0000',
  };
  const alert = { animalKind: 'wild_bird', conditions: ['injured'], count: 1, description: 'Coruja caída com a asa machucada', lat: -23.551234, lng: -46.634567 };
  const report = { type: 'neglect', description: 'Cachorro sem água e comida há dias no quintal.', ongoing: true, lat: -23.5, lng: -46.6, anonymous: true };

  it('exigem conta de verdade e dados válidos', async () => {
    expect((await call('createAdoption', null, adoption)).error?.status).toBe('UNAUTHENTICATED');
    const anon = await signUpAnonymous();
    expect((await call('createReport', anon.idToken, report)).error?.status).toBe('PERMISSION_DENIED');
    const { idToken } = await signUp('ana@example.com');
    expect((await call('createRescueAlert', idToken, { ...alert, conditions: [] })).error?.status).toBe('INVALID_ARGUMENT');
  });

  it('adoção: telefone vai para documento privado e a coordenada é arredondada (~1 km)', async () => {
    const { uid, idToken } = await signUp('ana@example.com');
    const res = (await call('createAdoption', idToken, adoption)) as { result?: { id: string } };
    const id = res.result!.id;
    const listing = (await getFirestore().doc(`adoption_listings/${id}`).get()).data()!;
    expect(listing).toMatchObject({ ownerId: uid, status: 'available', lat: -22.91, lng: -47.06, city: 'Campinas' });
    expect(listing.contactPhone).toBeUndefined();
    expect((await getFirestore().doc(`adoption_listings/${id}/private/contact`).get()).data()).toEqual({ ownerId: uid, contactPhone: '(19) 99999-0000' });

    // A dona muda o status e os dados; outra pessoa não consegue.
    expect((await call('updateAdoption', idToken, { id, status: 'adopted', data: { description: 'Já foi adotada, obrigado a todos!' } })).error).toBeUndefined();
    expect((await getFirestore().doc(`adoption_listings/${id}`).get()).data()).toMatchObject({ status: 'adopted', description: 'Já foi adotada, obrigado a todos!' });
    const bia = await signUp('bia@example.com');
    expect((await call('updateAdoption', bia.idToken, { id, status: 'available' })).error?.status).toBe('PERMISSION_DENIED');
    expect((await call('deleteAdoption', bia.idToken, { id })).error?.status).toBe('PERMISSION_DENIED');

    // Fotos só da pasta do próprio anúncio.
    expect((await call('updateAdoption', idToken, { id, photoPaths: ['pets/x/profile.jpg'] })).error?.status).toBe('INVALID_ARGUMENT');
    expect((await call('updateAdoption', idToken, { id, photoPaths: [`adoptions/${id}/photo-1.jpg`] })).error).toBeUndefined();

    expect((await call('deleteAdoption', idToken, { id })).error).toBeUndefined();
    expect((await getFirestore().doc(`adoption_listings/${id}`).get()).exists).toBe(false);
    expect((await getFirestore().doc(`adoption_listings/${id}/private/contact`).get()).exists).toBe(false);
  });

  it('resgate: guarda o ponto exato e quem anunciou atualiza o status', async () => {
    const { uid, idToken } = await signUp('ana@example.com');
    const res = (await call('createRescueAlert', idToken, alert)) as { result?: { id: string } };
    const id = res.result!.id;
    expect((await getFirestore().doc(`rescue_alerts/${id}`).get()).data()).toMatchObject({ reporterId: uid, status: 'open', lat: -23.551234 });
    expect((await call('updateRescueAlert', idToken, { id, status: 'rescued' })).error).toBeUndefined();
    expect((await getFirestore().doc(`rescue_alerts/${id}`).get()).data()?.status).toBe('rescued');
  });

  it('denúncia: fica privada, com status "recebida", e respeita o limite diário (5)', async () => {
    const { uid, idToken } = await signUp('ana@example.com');
    const first = (await call('createReport', idToken, report)) as { result?: { id: string } };
    expect((await getFirestore().doc(`reports/${first.result!.id}`).get()).data()).toMatchObject({ reporterId: uid, status: 'received', anonymous: true });
    for (let i = 0; i < 4; i += 1) expect((await call('createReport', idToken, report)).error).toBeUndefined();
    const blocked = await call('createReport', idToken, report);
    expect(blocked.error?.status).toBe('RESOURCE_EXHAUSTED');
    expect(blocked.error?.message).toBe('daily-limit');
  });
});
