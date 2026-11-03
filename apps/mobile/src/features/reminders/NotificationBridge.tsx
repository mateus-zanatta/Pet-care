import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { track } from '@/core/analytics';
import { reportError } from '@/core/errors/report';
import { getPref, setPref } from '@/core/storage/prefs';
import { useUser } from '@/features/auth/AuthProvider';
import { logDose } from '@/features/medications/medications.repo';
import { type NotificationResponseLike, handleNotificationResponse, rememberHandled } from './notificationActions';
import { getNotifications } from './notifications';

async function markHandled(key: string): Promise<boolean> {
  let list: string[] = [];
  try {
    const raw = await getPref('handledNotifications');
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    list = [];
  }
  const next = rememberHandled(list, key);
  if (next.isNew) await setPref('handledNotifications', JSON.stringify(next.list));
  return next.isNew;
}

/**
 * Escuta o toque nas notificações de dose (inclusive se o app estava fechado). Fica montado só com a pessoa logada.
 * Não desenha nada. Em um build sem o módulo de notificações, não faz nada.
 */
export function NotificationBridge() {
  const Notifications = getNotifications();
  return Notifications ? <ActiveBridge useLastResponse={Notifications.useLastNotificationResponse} /> : null;
}

function ActiveBridge({ useLastResponse }: { useLastResponse: () => NotificationResponseLike | null | undefined }) {
  const user = useUser();
  const router = useRouter();
  const response = useLastResponse();
  const handling = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handling.current === id) return;
    handling.current = id;

    handleNotificationResponse(response, {
      uid: user.uid,
      displayName: user.displayName,
      logDose: async (input) => {
        const result = await logDose(input);
        track({ name: 'dose_logged', outcome: input.outcome });
        return result;
      },
      openTarget: ({ kind, petId, refId }) => {
        if (kind.startsWith('vaccine_')) router.push({ pathname: '/pet/[id]/health/vaccine/[vid]', params: { id: petId, vid: refId } });
        else if (kind.startsWith('event_')) router.push({ pathname: '/pet/[id]/health/event/[eid]', params: { id: petId, eid: refId } });
        else router.push({ pathname: '/pet/[id]/medications/[medId]', params: { id: petId, medId: refId } });
      },
      markHandled,
    }).catch((error) => reportError('reminders.notificationAction', error));
  }, [response, router, user.uid, user.displayName]);

  return null;
}
