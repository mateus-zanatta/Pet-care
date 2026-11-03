import type { MedicationData, PlanMedication, ReminderItem } from '@petcare/shared';
import { rememberHandled, handleNotificationResponse, type ActionDeps, type NotificationResponseLike } from './notificationActions';
import { buildPayloads, lookupKey, reminderSignature } from './reminderContent';
import { resetSyncState, syncReminders, type SyncDeps } from './syncReminders';

// Os textos reais (pt-BR) são conferidos aqui, para pegar chave faltando ou texto sugerindo algo.
import meds from '@/locales/pt-BR/meds.json';

jest.mock('./notifications', () => ({ ACTION_GIVEN: 'given', ACTION_SKIPPED: 'skipped' }));

/** `t` simples para os testes: resolve a chave no JSON de verdade e troca {{variáveis}}. */
const t = (key: string, vars: Record<string, unknown> = {}): string => {
  const value = key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], meds);
  if (typeof value !== 'string') throw new Error(`chave de tradução ausente: ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars[name] ?? ''));
};
const formatDate = (iso: string) => iso.split('-').reverse().join('/');

const med = (over: Partial<MedicationData> = {}): MedicationData => ({
  name: 'Amoxicilina',
  dose: { amount: '1/2', unit: 'comprimido', route: 'oral' },
  frequency: { kind: 'interval', everyHours: 8 },
  startDate: '2026-11-01',
  startTime: '06:00',
  status: 'active',
  ...over,
});
const plan = (over: Partial<MedicationData> = {}): PlanMedication[] => [{ petId: 'p1', id: 'm1', med: med(over) }];

describe('buildPayloads (texto das notificações)', () => {
  const lookup = new Map([[lookupKey('p1', 'm1'), { petName: 'Mel', medName: 'Amoxicilina', doseAmount: '1/2', doseUnit: 'comprimido', expiresOn: '2027-03-01' }]]);
  const item = (kind: ReminderItem['kind'], at = new Date('2026-11-04T17:00:00.000Z')): ReminderItem => ({
    kind, petId: 'p1', medicationId: 'm1', at, key: `m1_${kind}`,
  });

  it('dose: pet, medicamento e a dose "como prescrita"; o horário agendado vai nos dados', () => {
    const [p] = buildPayloads([item('dose')], lookup, t, formatDate);
    expect(p!.title).toBe('Mel: hora do medicamento');
    expect(p!.body).toBe('Amoxicilina — 1/2 comprimido');
    expect(p!.data).toEqual({ kind: 'dose', petId: 'p1', medicationId: 'm1', scheduledFor: '2026-11-04T17:00:00.000Z' });
  });

  it.each(['ends_tomorrow', 'ends_today', 'expires_soon', 'expires_today'] as const)('aviso %s tem título e texto, sem horário de dose', (kind) => {
    const [p] = buildPayloads([item(kind)], lookup, t, formatDate);
    expect(p!.title).toContain('Mel');
    expect(p!.body).toContain('Amoxicilina');
    expect(p!.data.scheduledFor).toBeUndefined();
  });

  it('validade usa a data formatada na língua da pessoa', () => {
    const [p] = buildPayloads([item('expires_soon')], lookup, t, formatDate);
    expect(p!.body).toBe('Amoxicilina vence em 01/03/2027.');
  });

  it('ignora itens de remédios que não estão mais na lista (apagados)', () => {
    expect(buildPayloads([{ ...item('dose'), medicationId: 'ghost' }], lookup, t, formatDate)).toEqual([]);
  });

  it('NENHUM texto do app sugere medicamento, dose ou diagnóstico', () => {
    const all = JSON.stringify(meds.notify) + meds.disclaimer;
    expect(all).not.toMatch(/recomend|sugir|sugest|diagn[óo]stic.{0,20}(é|seria)|aumente|reduza|dobre/i);
    expect(meds.disclaimer).toMatch(/não sugere/i);
  });

  it('assinatura muda quando o texto ou o horário muda', () => {
    const a = buildPayloads([item('dose')], lookup, t, formatDate);
    const b = buildPayloads([item('dose', new Date('2026-11-04T18:00:00.000Z'))], lookup, t, formatDate);
    expect(reminderSignature(a)).not.toBe(reminderSignature(b));
    expect(reminderSignature(a)).toBe(reminderSignature(buildPayloads([item('dose')], lookup, t, formatDate)));
  });
});

describe('syncReminders', () => {
  const now = new Date(2026, 10, 4, 12, 0, 0);
  const apply = jest.fn(async () => undefined);
  const deps = (over: Partial<SyncDeps> = {}): SyncDeps => ({
    now: () => now, t, formatDate, hasPermission: async () => true, apply, ...over,
  });
  const sources = (over: Partial<MedicationData> = {}, logged: string[] = []) => ({
    meds: plan(over), petNames: { p1: 'Mel' }, loggedKeys: new Set(logged),
  });

  beforeEach(() => {
    resetSyncState();
    apply.mockClear();
  });

  it('sem permissão de notificação, não agenda nada', async () => {
    await expect(syncReminders(sources(), deps({ hasPermission: async () => false }))).resolves.toBe('skipped-permission');
    expect(apply).not.toHaveBeenCalled();
  });

  it('agenda a janela móvel de 72 h (9 doses de 8 h) com o nome do pet', async () => {
    await expect(syncReminders(sources(), deps())).resolves.toEqual({ scheduled: 9 });
    const payloads = (apply.mock.calls as unknown as [{ title: string }[]][])[0]![0];
    expect(payloads).toHaveLength(9);
    expect(payloads.every((p) => p.title.startsWith('Mel:'))).toBe(true);
  });

  it('se nada mudou, não reagenda (evita trabalho e piscadas)', async () => {
    await syncReminders(sources(), deps());
    await expect(syncReminders(sources(), deps())).resolves.toBe('unchanged');
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('dose registrada ("dei"/"pulei") sai do que está agendado', async () => {
    const first = (await (async () => {
      await syncReminders(sources(), deps());
      return (apply.mock.calls as unknown as [{ id: string }[]][])[0]![0][0]!.id;
    })());
    resetSyncState();
    apply.mockClear();
    await expect(syncReminders(sources({}, [first]), deps())).resolves.toEqual({ scheduled: 8 });
  });

  it('remédio suspenso deixa de ter lembretes: a lista agendada é esvaziada', async () => {
    await syncReminders(sources(), deps());
    await expect(syncReminders(sources({ status: 'suspended' }), deps())).resolves.toEqual({ scheduled: 0 });
    expect((apply.mock.calls as unknown as [unknown[]][])[1]![0]).toEqual([]);
  });
});

describe('handleNotificationResponse', () => {
  const response = (action: string, data: unknown = { kind: 'dose', petId: 'p1', medicationId: 'm1', scheduledFor: '2026-11-04T11:00:00.000Z' }, id = 'n1'): NotificationResponseLike => ({
    actionIdentifier: action,
    notification: { request: { identifier: id, content: { data } } },
  });
  const make = () => {
    const handled = new Set<string>();
    const deps: ActionDeps = {
      uid: 'u1',
      displayName: 'Ana',
      logDose: jest.fn(async () => undefined),
      openMedication: jest.fn(),
      markHandled: async (key) => {
        if (handled.has(key)) return false;
        handled.add(key);
        return true;
      },
    };
    return deps;
  };

  it('"Dei a dose" registra a dose agendada com quem deu', async () => {
    const deps = make();
    await expect(handleNotificationResponse(response('given'), deps)).resolves.toBe('logged');
    expect(deps.logDose).toHaveBeenCalledWith({
      petId: 'p1', medicationId: 'm1', scheduledFor: new Date('2026-11-04T11:00:00.000Z'), outcome: 'given', uid: 'u1', displayName: 'Ana',
    });
  });

  it('"Pulei" registra como pulada', async () => {
    const deps = make();
    await handleNotificationResponse(response('skipped'), deps);
    expect(deps.logDose).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'skipped' }));
  });

  it('toque comum abre o medicamento, sem registrar dose', async () => {
    const deps = make();
    await expect(handleNotificationResponse(response('expo.modules.notifications.actions.DEFAULT'), deps)).resolves.toBe('opened');
    expect(deps.openMedication).toHaveBeenCalledWith('p1', 'm1');
    expect(deps.logDose).not.toHaveBeenCalled();
  });

  it('a MESMA ação não é tratada duas vezes (o sistema pode devolver a última resposta ao reabrir o app)', async () => {
    const deps = make();
    await handleNotificationResponse(response('given'), deps);
    await expect(handleNotificationResponse(response('given'), deps)).resolves.toBe('duplicate');
    expect(deps.logDose).toHaveBeenCalledTimes(1);
  });

  it('dados estranhos ou botão desconhecido são ignorados', async () => {
    const deps = make();
    await expect(handleNotificationResponse(response('given', { kind: 'hacked' }), deps)).resolves.toBe('ignored');
    await expect(handleNotificationResponse(response('given', null, 'n2'), deps)).resolves.toBe('ignored');
    await expect(handleNotificationResponse(response('other-button', undefined, 'n3'), deps)).resolves.toBe('ignored');
    expect(deps.logDose).not.toHaveBeenCalled();
  });

  it('aviso de validade não tem botão de dose: "Dei a dose" nele é ignorado', async () => {
    const deps = make();
    const warning = response('given', { kind: 'expires_soon', petId: 'p1', medicationId: 'm1' });
    await expect(handleNotificationResponse(warning, deps)).resolves.toBe('ignored');
    expect(deps.logDose).not.toHaveBeenCalled();
  });
});

describe('rememberHandled', () => {
  it('guarda as últimas 60 ações e reconhece repetidas', () => {
    let list: string[] = [];
    for (let i = 0; i < 70; i += 1) list = rememberHandled(list, `k${i}`).list;
    expect(list).toHaveLength(60);
    expect(list[0]).toBe('k10');
    expect(rememberHandled(list, 'k69').isNew).toBe(false);
    expect(rememberHandled(list, 'novo').isNew).toBe(true);
  });
});
