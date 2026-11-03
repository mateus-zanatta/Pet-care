import type { Pet, PetMember } from '@petcare/shared';
import { useEffect, useState } from 'react';
import { reportError } from '@/core/errors/report';
import { photoVersion } from './pets.mapper';
import { getPhotoUrl, subscribeMemberships, subscribePet } from './pets.repo';

type Loadable<T> = { data: T; loading: boolean; failed: boolean };

/** Vínculos da pessoa com pets (dela e compartilhados), atualizados em tempo real. */
export function useMemberships(uid: string): Loadable<PetMember[]> {
  const [state, setState] = useState<{ uid: string; data: PetMember[]; failed: boolean } | null>(null);

  useEffect(
    () =>
      subscribeMemberships(
        uid,
        (data) => setState({ uid, data, failed: false }),
        (e) => {
          reportError('pets.memberships', e);
          setState({ uid, data: [], failed: true });
        },
      ),
    [uid],
  );

  // Se o usuário mudou, o estado antigo não vale: volta a "carregando".
  if (!state || state.uid !== uid) return { data: [], loading: true, failed: false };
  return { data: state.data, loading: false, failed: state.failed };
}

/** Um pet em tempo real. `data` é null se não existir ou se a pessoa não tiver acesso. */
export function usePet(petId: string | undefined): Loadable<Pet | null> {
  const [state, setState] = useState<{ petId: string; data: Pet | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!petId) return;
    return subscribePet(
      petId,
      (data) => setState({ petId, data, failed: false }),
      (e) => {
        // Sem permissão = o pet foi excluído ou deixou de ser compartilhado.
        const denied = (e as { code?: string }).code === 'firestore/permission-denied';
        if (!denied) reportError('pets.pet', e);
        setState({ petId, data: null, failed: !denied });
      },
    );
  }, [petId]);

  if (!petId) return { data: null, loading: false, failed: false };
  if (!state || state.petId !== petId) return { data: null, loading: true, failed: false };
  return { data: state.data, loading: false, failed: state.failed };
}

/** URL da foto do pet (ou null enquanto carrega / se não houver foto). */
export function usePetPhotoUrl(pet: Pick<Pet, 'photoPath' | 'photoUpdatedAt'> | null | undefined): string | null {
  const path = pet?.photoPath;
  const version = photoVersion(pet?.photoUpdatedAt);
  const key = path ? `${path}:${version}` : null;
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!path || !key) return;
    let cancelled = false;
    getPhotoUrl(path, version)
      .then((url) => {
        if (!cancelled) setLoaded({ key, url });
      })
      .catch((e) => reportError('pets.photoUrl', e));
    return () => {
      cancelled = true;
    };
  }, [path, version, key]);

  return key && loaded?.key === key ? loaded.url : null;
}
