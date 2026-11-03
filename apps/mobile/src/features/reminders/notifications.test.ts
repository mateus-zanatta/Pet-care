import type { NotificationPayload } from './reminderContent';

const payload = (kind: 'dose' | 'ends_today', id = 'm1_100'): NotificationPayload => ({
  id,
  at: new Date('2026-11-04T17:00:00.000Z'),
  title: 'Mel: hora do medicamento',
  body: 'Amoxicilina — 1/2 comprimido',
  data: { kind, petId: 'p1', refId: 'm1' },
});

/** Carrega `notifications.ts` do zero com (ou sem) o módulo nativo, já que o resultado fica em cache. */
function load(nativeModule: unknown) {
  jest.resetModules();
  if (nativeModule === 'missing') {
    jest.doMock('expo-notifications', () => {
      throw new Error("Cannot find native module 'ExpoPushTokenManager'");
    });
  } else {
    jest.doMock('expo-notifications', () => nativeModule);
  }
  return require('./notifications') as typeof import('./notifications');
}

describe('sem o módulo nativo (build antigo do app)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('nada quebra: permissão "unavailable" e as demais funções não fazem nada', async () => {
    const n = load('missing');
    expect(n.getNotifications()).toBeNull();
    await expect(n.getPermissionState()).resolves.toBe('unavailable');
    await expect(n.requestPermission()).resolves.toBe('unavailable');
    await expect(n.applySchedule([payload('dose')])).resolves.toBeUndefined();
    await expect(n.setupNotificationUi({ channel: 'c', given: 'g', skipped: 's' })).resolves.toBeUndefined();
    expect(() => n.configureNotificationHandler()).not.toThrow();
  });
});

describe('com o módulo nativo', () => {
  const makeModule = () => ({
    SchedulableTriggerInputTypes: { DATE: 'date' },
    AndroidImportance: { HIGH: 4 },
    cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
    scheduleNotificationAsync: jest.fn(async () => 'id'),
    setNotificationCategoryAsync: jest.fn(async () => ({})),
    setNotificationChannelAsync: jest.fn(async () => ({})),
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
  });

  it('applySchedule troca TUDO: cancela o que havia e agenda cada item no horário, no canal das doses', async () => {
    const mod = makeModule();
    const n = load(mod);
    await n.applySchedule([payload('dose', 'a'), payload('ends_today', 'b')]);

    expect(mod.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mod.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const [first] = mod.scheduleNotificationAsync.mock.calls[0] as unknown as [Record<string, any>];
    expect(first).toMatchObject({
      identifier: 'a',
      content: { title: 'Mel: hora do medicamento', categoryIdentifier: 'dose', sound: true },
      trigger: { type: 'date', date: new Date('2026-11-04T17:00:00.000Z'), channelId: 'doses' },
    });
    const [second] = mod.scheduleNotificationAsync.mock.calls[1] as unknown as [Record<string, any>];
    expect('categoryIdentifier' in second.content).toBe(false); // avisos não têm botões de dose
  });

  it('cria os botões "Dei a dose" e "Pulei", que abrem o app', async () => {
    const mod = makeModule();
    const n = load(mod);
    await n.setupNotificationUi({ channel: 'Lembretes', given: 'Dei a dose', skipped: 'Pulei' });
    expect(mod.setNotificationCategoryAsync).toHaveBeenCalledWith('dose', [
      { identifier: 'given', buttonTitle: 'Dei a dose', options: { opensAppToForeground: true } },
      { identifier: 'skipped', buttonTitle: 'Pulei', options: { opensAppToForeground: true } },
    ]);
  });

  it('traduz o estado da permissão do sistema', async () => {
    const mod = makeModule();
    const n = load(mod);
    mod.getPermissionsAsync.mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true });
    await expect(n.getPermissionState()).resolves.toBe('granted');
    mod.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied', canAskAgain: false });
    await expect(n.getPermissionState()).resolves.toBe('denied');
    mod.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true });
    await expect(n.getPermissionState()).resolves.toBe('undetermined');
    mod.requestPermissionsAsync.mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true });
    await expect(n.requestPermission()).resolves.toBe('granted');
  });
});
