import { useEffect, useState } from 'react';
import { reportError } from '@/core/errors/report';
import { getPhotoUrl } from './centrals.repo';

export type Live<T> = { data: T; loading: boolean; error: boolean };

/** Assina uma consulta do Firestore e devolve { data, loading, error }. `key` muda = assina de novo. */
export function useLive<T>(
  key: string | null,
  initial: T,
  subscribe: (onData: (data: T) => void, onError: (error: unknown) => void) => () => void,
  context: string,
): Live<T> {
  const [state, setState] = useState<{ key: string | null; data: T; error: boolean } | null>(null);

  useEffect(() => {
    if (!key) return;
    return subscribe(
      (data) => setState({ key, data, error: false }),
      (error) => {
        reportError(context, error);
        setState({ key, data: initial, error: true });
      },
    );
    // `subscribe` e `initial` mudam a cada render; a chave é que decide quando assinar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { data: initial, loading: false, error: false };
  if (!state || state.key !== key) return { data: initial, loading: true, error: false };
  return { data: state.data, loading: false, error: state.error };
}

/** URL da primeira foto (ou null), com cache. */
export function usePhotoUrl(path: string | undefined): string | null {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    getPhotoUrl(path, 0)
      .then((u) => alive && setUrl({ path, url: u }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return path && url?.path === path ? url.url : null;
}
