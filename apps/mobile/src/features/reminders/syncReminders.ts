import { type PlanMedication, buildReminderPlan } from '@petcare/shared';
import { type NotificationPayload, type ReminderLookup, buildPayloads, lookupKey, reminderSignature } from './reminderContent';

/** Tudo o que o agendador precisa saber, reunido de todos os pets que a pessoa pode cuidar. */
export type ReminderSources = {
  meds: PlanMedication[];
  petNames: Record<string, string>;
  /** IDs dos registros de dose já feitos ("dei" ou "pulei"). */
  loggedKeys: Set<string>;
};

export type SyncDeps = {
  now: () => Date;
  /** `t` do namespace "meds". */
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (iso: string) => string;
  hasPermission: () => Promise<boolean>;
  /** Troca TUDO o que está agendado por estas notificações. */
  apply: (payloads: NotificationPayload[]) => Promise<void>;
};

export type SyncResult = 'skipped-permission' | 'unchanged' | { scheduled: number };

let lastSignature: string | null = null;

/** Esquece o que foi agendado por último (usado em testes e ao trocar de conta). */
export function resetSyncState(): void {
  lastSignature = null;
}

/**
 * Reagenda a janela móvel de lembretes. Chamado quando o app abre e sempre que medicamentos ou doses mudam.
 * Sem permissão de notificação não agenda nada (a tela de medicamentos explica como liberar).
 */
export async function syncReminders(sources: ReminderSources, deps: SyncDeps): Promise<SyncResult> {
  if (!(await deps.hasPermission())) {
    lastSignature = null;
    return 'skipped-permission';
  }

  const plan = buildReminderPlan(sources.meds, deps.now(), sources.loggedKeys);
  const lookup: ReminderLookup = new Map(
    sources.meds.map(({ petId, id, med }) => [
      lookupKey(petId, id),
      {
        petName: sources.petNames[petId] ?? '',
        medName: med.name,
        doseAmount: med.dose.amount,
        doseUnit: med.dose.unit,
        expiresOn: med.expiresOn,
      },
    ]),
  );
  const payloads = buildPayloads(plan, lookup, deps.t, deps.formatDate);

  const signature = reminderSignature(payloads);
  if (signature === lastSignature) return 'unchanged';

  await deps.apply(payloads);
  lastSignature = signature;
  return { scheduled: payloads.length };
}
