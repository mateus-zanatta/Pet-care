import type { HealthEvent, Vaccine } from '@petcare/shared';
import { useEffect, useState } from 'react';
import { reportError } from '@/core/errors/report';
import { subscribeHealthEvents, subscribeVaccines } from './health.repo';

type Loadable<T> = { data: T; loading: boolean; failed: boolean };

/** Assinatura genérica de uma lista do pet, em tempo real. */
function useRecords<T>(
  petId: string | undefined,
  subscribe: (petId: string, onData: (items: T[]) => void, onError: (error: unknown) => void) => () => void,
  scope: string,
): Loadable<T[]> {
  const [state, setState] = useState<{ petId: string; data: T[]; failed: boolean } | null>(null);

  useEffect(() => {
    if (!petId) return;
    return subscribe(
      petId,
      (data) => setState({ petId, data, failed: false }),
      (e) => {
        reportError(scope, e);
        setState({ petId, data: [], failed: true });
      },
    );
  }, [petId, subscribe, scope]);

  if (!petId) return { data: [], loading: false, failed: false };
  if (!state || state.petId !== petId) return { data: [], loading: true, failed: false };
  return { data: state.data, loading: false, failed: state.failed };
}

export const useVaccines = (petId: string | undefined): Loadable<Vaccine[]> => useRecords(petId, subscribeVaccines, 'health.vaccines');
export const useHealthEvents = (petId: string | undefined): Loadable<HealthEvent[]> =>
  useRecords(petId, subscribeHealthEvents, 'health.events');
