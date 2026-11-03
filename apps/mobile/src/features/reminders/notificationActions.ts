import type { DoseOutcome } from '@petcare/shared';
import { z } from 'zod';
import { ACTION_GIVEN, ACTION_SKIPPED } from './notifications';

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

const dataSchema = z.object({
  kind: z.enum(['dose', 'ends_tomorrow', 'ends_today', 'expires_soon', 'expires_today']),
  petId: z.string().min(1),
  medicationId: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
});

export type NotificationResponseLike = {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data?: unknown } } };
};

export type ActionDeps = {
  uid: string;
  displayName: string | null;
  logDose: (input: {
    petId: string;
    medicationId: string;
    scheduledFor: Date;
    outcome: DoseOutcome;
    uid: string;
    displayName: string | null;
  }) => Promise<unknown>;
  openMedication: (petId: string, medicationId: string) => void;
  /** Guarda que esta ação já foi tratada. Devolve false se já tinha sido (não repetir). */
  markHandled: (key: string) => Promise<boolean>;
};

export type ActionResult = 'logged' | 'opened' | 'duplicate' | 'ignored';

/**
 * Trata o toque numa notificação:
 * - botão "Dei a dose" / "Pulei" -> registra a dose (quem e quando, do aparelho);
 * - toque comum -> abre o medicamento.
 * A mesma ação nunca é tratada duas vezes (o sistema pode devolver a última resposta ao reabrir o app).
 */
export async function handleNotificationResponse(response: NotificationResponseLike, deps: ActionDeps): Promise<ActionResult> {
  const parsed = dataSchema.safeParse(response.notification.request.content.data);
  if (!parsed.success) return 'ignored';
  const data = parsed.data;

  const action = response.actionIdentifier;
  const outcome: DoseOutcome | null = action === ACTION_GIVEN ? 'given' : action === ACTION_SKIPPED ? 'skipped' : null;
  if (!outcome && action !== DEFAULT_ACTION) return 'ignored';

  const key = `${response.notification.request.identifier}:${action}`;
  if (!(await deps.markHandled(key))) return 'duplicate';

  if (outcome) {
    if (data.kind !== 'dose' || !data.scheduledFor) return 'ignored';
    await deps.logDose({
      petId: data.petId,
      medicationId: data.medicationId,
      scheduledFor: new Date(data.scheduledFor),
      outcome,
      uid: deps.uid,
      displayName: deps.displayName,
    });
    return 'logged';
  }

  deps.openMedication(data.petId, data.medicationId);
  return 'opened';
}

/* ----------------- Memória das ações já tratadas (no aparelho) ----------------- */

const MAX_REMEMBERED = 60;

export function rememberHandled(list: readonly string[], key: string): { list: string[]; isNew: boolean } {
  if (list.includes(key)) return { list: [...list], isNew: false };
  return { list: [...list, key].slice(-MAX_REMEMBERED), isNew: true };
}
