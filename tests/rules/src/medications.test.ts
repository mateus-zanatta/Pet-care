import { type RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
  await seedPet('pet1', 'owner', { carer: 'caregiver', visitor: 'viewer' });
});

const db = (uid: string) => env.authenticatedContext(uid, registered).firestore();

async function seedPet(petId: string, ownerId: string, members: Record<string, string> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'pets', petId), validPet(ownerId));
    await setDoc(doc(fs, 'pet_members', `${petId}_${ownerId}`), { petId, uid: ownerId, role: 'owner', addedAt: new Date() });
    for (const [uid, role] of Object.entries(members)) {
      await setDoc(doc(fs, 'pet_members', `${petId}_${uid}`), { petId, uid, role, addedAt: new Date() });
    }
  });
}

const medication = (createdBy: string, overrides: Record<string, unknown> = {}) => ({
  name: 'Amoxicilina',
  dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
  frequency: { kind: 'interval', everyHours: 8 },
  startDate: '2026-11-04',
  startTime: '08:00',
  endDate: '2026-11-11',
  status: 'active',
  place: { kind: 'home' },
  createdBy,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

async function seedMedication(petId = 'pet1', id = 'med1', createdBy = 'owner') {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'pets', petId, 'medications', id), medication(createdBy)));
}

const medRef = (uid: string, petId = 'pet1', id = 'med1') => doc(db(uid), 'pets', petId, 'medications', id);

describe('medications: quem pode o quê', () => {
  it('dono e cuidador criam; visualizador e quem não é membro não', async () => {
    await assertSucceeds(setDoc(medRef('owner'), medication('owner')));
    await assertSucceeds(setDoc(medRef('carer', 'pet1', 'med2'), medication('carer')));
    await assertFails(setDoc(medRef('visitor', 'pet1', 'med3'), medication('visitor')));
    await assertFails(setDoc(medRef('stranger', 'pet1', 'med4'), medication('stranger')));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'pets/pet1/medications/med5'), medication('x')));
  });

  it('todos os membros leem (inclusive o visualizador); estranhos não', async () => {
    await seedMedication();
    for (const uid of ['owner', 'carer', 'visitor']) await assertSucceeds(getDoc(medRef(uid)));
    await assertFails(getDoc(medRef('stranger')));
    await assertFails(getDocs(collection(db('stranger'), 'pets', 'pet1', 'medications')));
  });

  it('o criador registrado precisa ser a própria pessoa', async () => {
    await assertFails(setDoc(medRef('carer'), medication('owner')));
  });

  it('ser membro de um pet não dá acesso aos remédios de outro', async () => {
    await seedPet('pet2', 'someoneElse');
    await assertFails(setDoc(medRef('owner', 'pet2'), medication('owner')));
  });

  it('editar: dono e cuidador sim (ex.: concluir o tratamento); visualizador não; autor e criação não mudam', async () => {
    await seedMedication('pet1', 'med1', 'owner');
    await assertSucceeds(updateDoc(medRef('carer'), { status: 'completed', updatedAt: new Date() }));
    await assertFails(updateDoc(medRef('visitor'), { status: 'suspended', updatedAt: new Date() }));
    await assertFails(updateDoc(medRef('carer'), { createdBy: 'carer' }));
    await assertFails(updateDoc(medRef('carer'), { createdAt: new Date('2000-01-01') }));
  });

  it('excluir: dono e cuidador sim; visualizador não', async () => {
    await seedMedication();
    await assertFails(deleteDoc(medRef('visitor')));
    await assertSucceeds(deleteDoc(medRef('carer')));
  });
});

describe('medications: validação dos campos', () => {
  const rejects = (name: string, overrides: Record<string, unknown>) =>
    it(`rejeita ${name}`, async () => {
      await assertFails(setDoc(medRef('owner'), medication('owner', overrides)));
    });

  rejects('campo extra (ex.: o app NUNCA guarda sugestão de dose)', { suggestedDose: '2 comprimidos' });
  rejects('nome vazio', { name: '' });
  rejects('nome com mais de 80 caracteres', { name: 'x'.repeat(81) });
  rejects('status desconhecido', { status: 'paused' });
  rejects('via desconhecida', { dose: { amount: '1', unit: 'ml', route: 'rectal' } });
  rejects('dose sem unidade', { dose: { amount: '1', route: 'oral' } });
  rejects('dose com campo extra', { dose: { amount: '1', unit: 'ml', route: 'oral', max: '9' } });
  rejects('intervalo de 0 hora', { frequency: { kind: 'interval', everyHours: 0 } });
  rejects('intervalo maior que 1 semana', { frequency: { kind: 'interval', everyHours: 169 } });
  rejects('intervalo fracionado', { frequency: { kind: 'interval', everyHours: 1.5 } });
  rejects('horários fixos vazios', { frequency: { kind: 'fixed', times: [] } });
  rejects('mais de 12 horários', { frequency: { kind: 'fixed', times: Array.from({ length: 13 }, (_, i) => `${String(i).padStart(2, '0')}:00`) } });
  rejects('horário fixo mal formado', { frequency: { kind: 'fixed', times: ['8:00'] } });
  rejects('frequência desconhecida', { frequency: { kind: 'random' } });
  rejects('data de início mal formada', { startDate: '04/11/2026' });
  rejects('data final mal formada', { endDate: '2026-13-01x' });
  rejects('1º horário inválido', { startTime: '25:00' });
  rejects('local desconhecido', { place: { kind: 'moon' } });
  rejects('observações enormes', { notes: 'x'.repeat(1001) });
  rejects('veterinário com campo extra', { vet: { name: 'Ana', cpf: '000' } });

  it('aceita horários fixos, uso contínuo (sem data final) e veterinário/local completos', async () => {
    await assertSucceeds(
      setDoc(
        medRef('owner'),
        (() => {
          const { endDate: _endDate, ...rest } = medication('owner');
          return {
            ...rest,
            frequency: { kind: 'fixed', times: ['08:00', '20:00'] },
            vet: { name: 'Dra. Ana', crmvNumber: '12345', crmvUf: 'SP' },
            place: { kind: 'clinic', text: 'Clínica Pet Feliz' },
            barcode: '7891234567895',
            batch: 'L123',
            expiresOn: '2027-03-01',
            prescribedOn: '2026-11-03',
            notes: 'sem reações',
          };
        })(),
      ),
    );
  });
});

describe('dose_logs', () => {
  const scheduled = new Date('2026-11-04T11:00:00.000Z');
  const minutes = Math.floor(scheduled.getTime() / 60_000);
  const logId = `med1_${minutes}`;
  const log = (byUid: string, overrides: Record<string, unknown> = {}) => ({
    medicationId: 'med1',
    scheduledFor: scheduled.toISOString(),
    outcome: 'given',
    actualAt: '2026-11-04T11:05:00.000Z',
    byUid,
    byName: 'Cuidador',
    createdAt: new Date(),
    ...overrides,
  });
  const logRef = (uid: string, id = logId) => doc(db(uid), 'pets', 'pet1', 'dose_logs', id);

  beforeEach(async () => {
    await seedMedication();
  });

  it('dono e cuidador registram "dei"; visualizador e estranho não', async () => {
    await assertSucceeds(setDoc(logRef('carer'), log('carer')));
    await assertFails(setDoc(logRef('visitor', `med1_${minutes + 1}`), log('visitor', { scheduledFor: '2026-11-04T11:01:00.000Z' })));
    await assertFails(setDoc(logRef('stranger', `med1_${minutes + 2}`), log('stranger')));
  });

  it('o autor registrado é sempre quem está logado (ninguém registra "em nome de" outra pessoa)', async () => {
    await assertFails(setDoc(logRef('carer'), log('owner')));
  });

  it('membros leem o histórico; estranhos não', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'pets/pet1/dose_logs', logId), log('owner')));
    await assertSucceeds(getDoc(logRef('visitor')));
    await assertFails(getDoc(logRef('stranger')));
  });

  it('exige que o remédio exista nesse pet e que o ID bata com o remédio', async () => {
    await assertFails(setDoc(logRef('owner', `ghost_${minutes}`), log('owner', { medicationId: 'ghost' })));
    await assertFails(setDoc(logRef('owner', `med2_${minutes}`), log('owner'))); // ID de outro remédio
    await assertFails(setDoc(logRef('owner', 'sem-minutos'), log('owner')));
  });

  it('rejeita resultado inválido, datas sem fuso e campo extra', async () => {
    await assertFails(setDoc(logRef('owner'), log('owner', { outcome: 'maybe' })));
    await assertFails(setDoc(logRef('owner'), log('owner', { scheduledFor: '2026-11-04 08:00' })));
    await assertFails(setDoc(logRef('owner'), log('owner', { actualAt: 'ontem' })));
    await assertFails(setDoc(logRef('owner'), log('owner', { comment: 'oi' })));
  });

  it('corrigir "dei" para "pulei" pode; trocar o horário agendado ou o remédio não', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'pets/pet1/dose_logs', logId), log('owner')));
    await assertSucceeds(
      setDoc(logRef('carer'), { ...log('carer', { outcome: 'skipped' }), createdAt: (await getCreatedAt(logId)) }),
    );
    await assertFails(setDoc(logRef('carer'), { ...log('carer', { scheduledFor: '2026-11-05T11:00:00.000Z' }), createdAt: await getCreatedAt(logId) }));
  });

  it('registrar a MESMA dose de novo (toque duplo, notificação + app) é aceito com o carimbo do servidor, mas não com uma data inventada', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'pets/pet1/dose_logs', logId), log('owner')));
    await assertSucceeds(setDoc(logRef('carer'), { ...log('carer', { outcome: 'skipped' }), createdAt: serverTimestamp() }));
    await assertFails(setDoc(logRef('carer'), { ...log('carer'), createdAt: new Date('2001-01-01') }));
  });

  it('desfazer: dono e cuidador excluem o registro; visualizador não', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'pets/pet1/dose_logs', logId), log('owner')));
    await assertFails(deleteDoc(logRef('visitor')));
    await assertSucceeds(deleteDoc(logRef('carer')));
  });

  async function getCreatedAt(id: string) {
    let created: unknown;
    await env.withSecurityRulesDisabled(async (ctx) => {
      created = (await getDoc(doc(ctx.firestore(), 'pets/pet1/dose_logs', id))).data()?.createdAt;
    });
    return created;
  }
});
