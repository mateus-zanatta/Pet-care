import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { type PermissionState, getPermissionState, requestPermission } from './notifications';

/** Estado da permissão de notificações; atualiza quando a pessoa volta das configurações do aparelho. */
export function useReminderPermission() {
  const [state, setState] = useState<PermissionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await getPermissionState();
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState(null);
      }
    };
    void load();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const request = useCallback(async (): Promise<PermissionState | null> => {
    try {
      const next = await requestPermission();
      setState(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  return { state, request };
}
