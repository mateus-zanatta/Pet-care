import type { DoseLog, Medication } from '@petcare/shared';
import { useEffect, useState } from 'react';
import { reportError } from '@/core/errors/report';
import { subscribeDoseLogs, subscribeMedications } from './medications.repo';

type Loadable<T> = { data: T; loading: boolean; failed: boolean };

/** Medicamentos de um pet, em tempo real. */
export function useMedications(petId: string | undefined): Loadable<Medication[]> {
  const [state, setState] = useState<{ petId: string; data: Medication[]; failed: boolean } | null>(null);

  useEffect(() => {
    if (!petId) return;
    return subscribeMedications(
      petId,
      (data) => setState({ petId, data, failed: false }),
      (e) => {
        reportError('medications.list', e);
        setState({ petId, data: [], failed: true });
      },
    );
  }, [petId]);

  if (!petId) return { data: [], loading: false, failed: false };
  if (!state || state.petId !== petId) return { data: [], loading: true, failed: false };
  return { data: state.data, loading: false, failed: state.failed };
}

/** Registros de dose de um pet desde `sinceIso`. */
export function useDoseLogs(petId: string | undefined, sinceIso: string): Loadable<DoseLog[]> {
  const [state, setState] = useState<{ key: string; data: DoseLog[]; failed: boolean } | null>(null);
  const key = `${petId}:${sinceIso}`;

  useEffect(() => {
    if (!petId) return;
    return subscribeDoseLogs(
      petId,
      sinceIso,
      (data) => setState({ key, data, failed: false }),
      (e) => {
        reportError('medications.doseLogs', e);
        setState({ key, data: [], failed: true });
      },
    );
  }, [petId, sinceIso, key]);

  if (!petId) return { data: [], loading: false, failed: false };
  if (!state || state.key !== key) return { data: [], loading: true, failed: false };
  return { data: state.data, loading: false, failed: state.failed };
}
