import { Platform } from 'react-native';
import type { NotificationPayload } from './reminderContent';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * Carrega o módulo nativo de notificações com tolerância: um build ANTIGO do app (sem o módulo) continua
 * abrindo normalmente; só os lembretes ficam indisponíveis. Devolve null nesse caso.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carregamento tolerante, de propósito
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
    if (__DEV__) {
      console.warn('[lembretes] O módulo de notificações não existe neste build do app. Gere um novo development build.');
    }
  }
  return cached;
}

/**
 * Ponte fina com o expo-notifications. Sem regra de negócio aqui: o QUE agendar é calculado em
 * `@petcare/shared` (testado) e o texto em `reminderContent.ts`. Só roda no app nativo.
 */

export const DOSE_CATEGORY = 'dose';
export const ACTION_GIVEN = 'given';
export const ACTION_SKIPPED = 'skipped';
export const DOSE_CHANNEL = 'doses';

/** `unavailable`: este build do app não tem o módulo de notificações. */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Com o app aberto, a notificação também aparece (a pessoa pode estar em outra tela). */
export function configureNotificationHandler(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Canal do Android e botões "Dei a dose" / "Pulei". Os botões abrem o app para registrar com segurança. */
export async function setupNotificationUi(labels: { channel: string; given: string; skipped: string }): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DOSE_CHANNEL, {
      name: labels.channel,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    { identifier: ACTION_GIVEN, buttonTitle: labels.given, options: { opensAppToForeground: true } },
    { identifier: ACTION_SKIPPED, buttonTitle: labels.skipped, options: { opensAppToForeground: true } },
  ]);
}

function toState(response: { granted: boolean; status: string; canAskAgain: boolean }): PermissionState {
  if (response.granted) return 'granted';
  if (response.status === 'denied' && !response.canAskAgain) return 'denied';
  return 'undetermined';
}

export async function getPermissionState(): Promise<PermissionState> {
  const Notifications = getNotifications();
  if (!Notifications) return 'unavailable';
  return toState(await Notifications.getPermissionsAsync());
}

/** Pede a permissão (o sistema mostra o aviso). Chame no momento em que a pessoa cria um lembrete. */
export async function requestPermission(): Promise<PermissionState> {
  const Notifications = getNotifications();
  if (!Notifications) return 'unavailable';
  return toState(await Notifications.requestPermissionsAsync());
}

/** Troca TUDO o que está agendado pelas notificações recebidas (a janela móvel). */
export async function applySchedule(payloads: readonly NotificationPayload[]): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of payloads) {
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: {
        title: p.title,
        body: p.body,
        data: p.data,
        sound: true,
        ...(p.data.kind === 'dose' ? { categoryIdentifier: DOSE_CATEGORY } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: DOSE_CHANNEL },
    });
  }
}
