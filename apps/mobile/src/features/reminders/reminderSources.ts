import type { DoseLog, Medication } from '@petcare/shared';
import { doseLogId } from '@petcare/shared';
import { reportError } from '@/core/errors/report';
import { subscribeDoseLogs, subscribeMedications } from '@/features/medications/medications.repo';
import { subscribeMemberships, subscribePet } from '@/features/pets/pets.repo';
import type { ReminderSources } from './syncReminders';

const HOUR_MS = 3_600_000;
/** Registros de dose de até 48 h atrás bastam para saber o que já foi dado nas próximas 72 h. */
const LOGS_LOOKBACK_HOURS = 48;

type PetState = { stop: () => void; meds?: Medication[]; logs?: DoseLog[] };

/**
 * Acompanha, em tempo real, os pets em que a pessoa dá doses (dono e cuidador) e junta tudo num único
 * "retrato" para o agendador. Quem só visualiza não recebe lembretes de dose.
 */
export function subscribeReminderSources(
  uid: string,
  onChange: (sources: ReminderSources) => void,
  now: () => Date = () => new Date(),
): () => void {
  const pets = new Map<string, PetState>();
  const names: Record<string, string> = {};
  let stopped = false;

  const emit = () => {
    if (stopped) return;
    const meds: ReminderSources['meds'] = [];
    const loggedKeys = new Set<string>();
    for (const [petId, state] of pets) {
      for (const med of state.meds ?? []) meds.push({ petId, id: med.id, med });
      for (const log of state.logs ?? []) loggedKeys.add(log.id || doseLogId(log.medicationId, new Date(log.scheduledFor)));
    }
    onChange({ meds, petNames: { ...names }, loggedKeys });
  };

  const watchPet = (petId: string): PetState => {
    const since = new Date(now().getTime() - LOGS_LOOKBACK_HOURS * HOUR_MS).toISOString();
    const state: PetState = { stop: () => undefined };
    const stops = [
      subscribePet(
        petId,
        (pet) => {
          if (pet) names[petId] = pet.name;
          emit();
        },
        (e) => reportError('reminders.pet', e),
      ),
      subscribeMedications(
        petId,
        (items) => {
          state.meds = items;
          emit();
        },
        (e) => reportError('reminders.medications', e),
      ),
      subscribeDoseLogs(
        petId,
        since,
        (items) => {
          state.logs = items;
          emit();
        },
        (e) => reportError('reminders.doseLogs', e),
      ),
    ];
    state.stop = () => stops.forEach((stop) => stop());
    return state;
  };

  const stopMemberships = subscribeMemberships(
    uid,
    (members) => {
      const wanted = new Set(members.filter((m) => m.role === 'owner' || m.role === 'caregiver').map((m) => m.petId));
      for (const [petId, state] of pets) {
        if (!wanted.has(petId)) {
          state.stop();
          pets.delete(petId);
        }
      }
      for (const petId of wanted) if (!pets.has(petId)) pets.set(petId, watchPet(petId));
      emit();
    },
    (e) => reportError('reminders.memberships', e),
  );

  return () => {
    stopped = true;
    stopMemberships();
    for (const state of pets.values()) state.stop();
    pets.clear();
  };
}
