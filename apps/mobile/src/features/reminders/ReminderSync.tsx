import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatIsoDate } from '@/core/dates';
import { reportError } from '@/core/errors/report';
import { useUser } from '@/features/auth/AuthProvider';
import { applySchedule, configureNotificationHandler, getPermissionState, setupNotificationUi } from './notifications';
import { subscribeReminderSources } from './reminderSources';
import { type ReminderSources, resetSyncState, syncReminders } from './syncReminders';

configureNotificationHandler();

function useIsAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * Mantém os lembretes agendados: observa medicamentos e doses dos pets da pessoa e, quando o app abre ou
 * algo muda, reagenda a janela móvel (o iOS guarda no máximo 64 notificações). Não desenha nada.
 */
export function ReminderSync() {
  const user = useUser();
  const { t, i18n } = useTranslation('meds');
  const active = useIsAppActive();
  const [sources, setSources] = useState<ReminderSources | null>(null);
  const locale = i18n.language === 'en' ? 'en' : 'pt-BR';

  useEffect(() => {
    resetSyncState();
    return subscribeReminderSources(user.uid, setSources);
  }, [user.uid]);

  useEffect(() => {
    setupNotificationUi({ channel: t('notify.channel'), given: t('notify.given'), skipped: t('notify.skipped') }).catch((e) =>
      reportError('reminders.setup', e),
    );
  }, [t, locale]);

  useEffect(() => {
    if (!sources || !active) return;
    syncReminders(sources, {
      now: () => new Date(),
      t: (key, options) => String(t(key as never, options as never)),
      formatDate: (iso) => formatIsoDate(iso, locale),
      hasPermission: async () => (await getPermissionState()) === 'granted',
      apply: applySchedule,
    }).catch((e) => reportError('reminders.sync', e));
  }, [sources, active, t, locale]);

  return null;
}
