import type { DoseLog, HealthEvent, Medication, PetMember, Vaccine } from '@petcare/shared';
import { subscribeReminderSources } from './reminderSources';
import type { ReminderSources } from './syncReminders';

/** Cada assinatura vira um "canal" que o teste alimenta à mão e cujo cancelamento é registrado. */
type Channel<T> = { push: (items: T) => void; stopped: boolean };
const mockChannels = {
  memberships: [] as Channel<PetMember[]>[],
  pet: new Map<string, Channel<{ name: string } | null>>(),
  meds: new Map<string, Channel<Medication[]>>(),
  logs: new Map<string, Channel<DoseLog[]>>(),
  vaccines: new Map<string, Channel<Vaccine[]>>(),
  events: new Map<string, Channel<HealthEvent[]>>(),
};

function mockMakeChannel<T>(onData: (v: T) => void): { channel: Channel<T>; stop: () => void } {
  const channel: Channel<T> = { push: onData, stopped: false };
  return { channel, stop: () => { channel.stopped = true; } };
}

jest.mock('@/core/errors/report', () => ({ reportError: jest.fn() }));
jest.mock('@/features/pets/pets.repo', () => ({
  subscribeMemberships: (_uid: string, onData: (m: PetMember[]) => void) => {
    const { channel, stop } = mockMakeChannel(onData);
    mockChannels.memberships.push(channel);
    return stop;
  },
  subscribePet: (petId: string, onData: (p: { name: string } | null) => void) => {
    const { channel, stop } = mockMakeChannel(onData);
    mockChannels.pet.set(petId, channel);
    return stop;
  },
}));
jest.mock('@/features/medications/medications.repo', () => ({
  subscribeMedications: (petId: string, onData: (m: Medication[]) => void) => {
    const { channel, stop } = mockMakeChannel(onData);
    mockChannels.meds.set(petId, channel);
    return stop;
  },
  subscribeDoseLogs: (petId: string, _since: string, onData: (l: DoseLog[]) => void) => {
    const { channel, stop } = mockMakeChannel(onData);
    mockChannels.logs.set(petId, channel);
    return stop;
  },
}));
jest.mock('@/features/health/health.repo', () => ({
  subscribeVaccines: (petId: string, onData: (v: Vaccine[]) => void) => {
    const { channel, stop } = mockMakeChannel(onData);
    mockChannels.vaccines.set(petId, channel);
    return stop;
  },
  subscribeHealthEvents: (petId: string, onData: (e: HealthEvent[]) => void) => {
    const { channel, stop } = mockMakeChannel(onData);
    mockChannels.events.set(petId, channel);
    return stop;
  },
}));

const member = (petId: string, role: PetMember['role']): PetMember => ({ petId, uid: 'u1', role });
const med = (id: string): Medication => ({
  id, name: `Med ${id}`, dose: { amount: '1', unit: 'ml', route: 'oral' }, frequency: { kind: 'interval', everyHours: 8 },
  startDate: '2026-11-01', status: 'active', createdBy: 'u1',
});

let latest: ReminderSources | null;
const start = () => subscribeReminderSources('u1', (s) => { latest = s; }, () => new Date('2026-11-04T12:00:00.000Z'));

beforeEach(() => {
  latest = null;
  mockChannels.memberships.length = 0;
  for (const m of [mockChannels.pet, mockChannels.meds, mockChannels.logs, mockChannels.vaccines, mockChannels.events]) m.clear();
});

describe('subscribeReminderSources', () => {
  it('só acompanha pets em que a pessoa dá doses (dono e cuidador); visualizador fica de fora', () => {
    start();
    mockChannels.memberships[0]!.push([member('p1', 'owner'), member('p2', 'caregiver'), member('p3', 'viewer')]);
    expect([...mockChannels.meds.keys()].sort()).toEqual(['p1', 'p2']);
    expect(mockChannels.vaccines.has('p3')).toBe(false);
  });

  it('junta medicamentos, doses registradas, nomes dos pets e próximas datas de vacinas e eventos', () => {
    start();
    mockChannels.memberships[0]!.push([member('p1', 'owner')]);
    mockChannels.pet.get('p1')!.push({ name: 'Mel' });
    mockChannels.meds.get('p1')!.push([med('m1')]);
    mockChannels.logs.get('p1')!.push([{ id: 'm1_100', medicationId: 'm1', scheduledFor: '2026-11-04T11:00:00.000Z', outcome: 'given', actualAt: '2026-11-04T11:01:00.000Z', byUid: 'u1' }]);
    mockChannels.vaccines.get('p1')!.push([
      { id: 'v1', name: 'V10', appliedOn: '2026-03-01', nextDoseOn: '2027-03-01', createdBy: 'u1' },
      { id: 'v2', name: 'Sem próxima', appliedOn: '2026-03-01', createdBy: 'u1' },
    ]);
    mockChannels.events.get('p1')!.push([{ id: 'e1', type: 'deworming', title: 'Vermífugo', date: '2026-10-01', nextDate: '2026-11-30', createdBy: 'u1' }]);

    expect(latest!.petNames).toEqual({ p1: 'Mel' });
    expect(latest!.meds).toHaveLength(1);
    expect(latest!.meds[0]).toMatchObject({ petId: 'p1', id: 'm1' });
    expect([...latest!.loggedKeys]).toEqual(['m1_100']);
    expect(latest!.dues).toEqual([
      { petId: 'p1', id: 'v1', source: 'vaccine', dueOn: '2027-03-01' },
      { petId: 'p1', id: 'e1', source: 'event', dueOn: '2026-11-30' },
    ]);
    expect(latest!.dueTitles).toEqual({ 'p1/v1': 'V10', 'p1/e1': 'Vermífugo' });
  });

  it('se a pessoa deixa de ser membro de um pet, as assinaturas dele são encerradas e os dados somem', () => {
    start();
    mockChannels.memberships[0]!.push([member('p1', 'owner'), member('p2', 'owner')]);
    mockChannels.meds.get('p1')!.push([med('a')]);
    mockChannels.meds.get('p2')!.push([med('b')]);
    expect(latest!.meds).toHaveLength(2);

    const p2Channels = [mockChannels.pet.get('p2')!, mockChannels.meds.get('p2')!, mockChannels.logs.get('p2')!, mockChannels.vaccines.get('p2')!, mockChannels.events.get('p2')!];
    mockChannels.memberships[0]!.push([member('p1', 'owner')]);
    expect(p2Channels.every((c) => c.stopped)).toBe(true);
    expect(latest!.meds.map((m) => m.id)).toEqual(['a']);
  });

  it('ao cancelar, encerra tudo e não emite mais nada', () => {
    const stop = start();
    mockChannels.memberships[0]!.push([member('p1', 'owner')]);
    const all = [mockChannels.memberships[0]!, mockChannels.pet.get('p1')!, mockChannels.meds.get('p1')!, mockChannels.logs.get('p1')!, mockChannels.vaccines.get('p1')!, mockChannels.events.get('p1')!];
    stop();
    expect(all.every((c) => c.stopped)).toBe(true);
    latest = null;
    mockChannels.meds.get('p1')!.push([med('z')]);
    expect(latest).toBeNull();
  });
});
