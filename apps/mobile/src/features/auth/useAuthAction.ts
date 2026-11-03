import { useCallback, useState } from 'react';
import { reportError } from '@/core/errors/report';
import { type AuthErrorKey, isCancelled, mapAuthError } from './errors';

/** Executa uma ação de login controlando "carregando" e o erro a mostrar (cancelar não é erro). */
export function useAuthAction() {
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);

  const run = useCallback(async (context: string, action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setErrorKey(null);
    try {
      await action();
      return true;
    } catch (error) {
      if (!isCancelled(error)) {
        reportError(context, error);
        setErrorKey(mapAuthError(error));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, errorKey, run, clearError: () => setErrorKey(null) };
}
