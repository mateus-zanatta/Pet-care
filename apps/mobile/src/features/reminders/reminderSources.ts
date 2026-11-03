import type { DoseLog, HealthEvent, Medication, PlanDue, Vaccine } from '@petcare/shared';
import { doseLogId } from '@petcare/shared';
import { reportError } from '@/core/errors/report';
import { subscribeDoseLogs, subscribeMedications } from '@/features/medications/medications.repo';
import { subscribeHealthEvents, subscribeVaccines } from '@/features/health/health.repo';
import { subscribeMemberships, subscribePet } from '@/features/pets/pets.repo';
import { lookupKey } from './reminderContent';
import type { ReminderSources } from './syncReminders';

const HOUR_MS = 3_600_000;
/** Registros de dose de até 48 h atrás bastam para saber o que já foi dado nas próximas 72 h. */
const LOGS_LOOKBACK_HOURS = 48;

type PetState = { stop: () => void; meds?: Medication[]; logs?: DoseLog[]; vaccines?: Vaccine[]; events?: HealthEvent[] };

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
    const dues: PlanDue[] = [];
    const dueTitles: Record<string, string> = {};
    const loggedKeys = new Set<string>();
    for (const [petId, state] of pets) {
      for (const med of state.meds ?? []) meds.push({ petId, id: med.id, med });
      for (const log of state.logs ?? []) loggedKeys.add(log.id || doseLogId(log.medicationId, new Date(log.scheduledFor)));
      for (const v of state.vaccines ?? []) {
        if (!v.nextDoseOn) continue;
        dues.push({ petId, id: v.id, source: 'vaccine', dueOn: v.nextDoseOn });
        dueTitles[lookupKey(petId, v.id)] = v.name;
      }
      for (const e of state.events ?? []) {
        if (!e.nextDate) continue;
        dues.push({ petId, id: e.id, source: 'event', dueOn: e.nextDate });
        dueTitles[lookupKey(petId, e.id)] = e.title;
      }
    }
    onChange({ meds, dues, dueTitles, petNames: { ...names }, loggedKeys });
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
      subscribeVaccines(
        petId,
        (items) => {
          state.vaccines = items;
          emit();
        },
        (e) => reportError('reminders.vaccines', e),
      ),
      subscribeHealthEvents(
        petId,
        (items) => {
          state.events = items;
          emit();
        },
        (e) => reportError('reminders.healthEvents', e),
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
