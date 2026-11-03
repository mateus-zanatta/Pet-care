import { z } from 'zod';
import { DOSE_OUTCOME } from '../enums';

/**
 * ID determinístico do registro de dose: remédio + minuto agendado (minutos desde 1970, UTC).
 * Assim, tocar duas vezes (ou na notificação e no app) NÃO cria dois registros da mesma dose.
 */
export function doseLogId(medicationId: string, scheduledFor: Date): string {
  return `${medicationId}_${Math.floor(scheduledFor.getTime() / 60_000)}`;
}

/** `pets/{petId}/dose_logs/{medicationId}_{minutos}` */
export const doseLogDataSchema = z.object({
  medicationId: z.string().min(1),
  /** Instante agendado da dose, em ISO 8601 UTC (ex.: 2026-11-04T11:00:00.000Z). */
  scheduledFor: z.string().datetime(),
  outcome: z.enum(DOSE_OUTCOME),
  /** Horário real em que a pessoa registrou (relógio do aparelho), ISO 8601 UTC. */
  actualAt: z.string().datetime(),
  byUid: z.string().min(1),
  byName: z.string().max(80).optional(),
});
export type DoseLogData = z.infer<typeof doseLogDataSchema>;
export type DoseLog = DoseLogData & { id: string };
