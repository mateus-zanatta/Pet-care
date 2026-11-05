import type { FavoritePlace } from '@petcare/shared';
import { useEffect, useState } from 'react';
import { reportError } from '@/core/errors/report';
import { subscribeFavorites } from './favorites.repo';

/** Favoritos da pessoa (vazio para quem está sem cadastro). */
export function useFavorites(uid: string | null, enabled = true): FavoritePlace[] {
  const [state, setState] = useState<{ uid: string; items: FavoritePlace[] } | null>(null);

  useEffect(() => {
    if (!uid || !enabled) return;
    return subscribeFavorites(
      uid,
      (items) => setState({ uid, items }),
      (e) => reportError('nearby.favorites', e),
    );
  }, [uid, enabled]);

  return uid && enabled && state?.uid === uid ? state.items : [];
}
