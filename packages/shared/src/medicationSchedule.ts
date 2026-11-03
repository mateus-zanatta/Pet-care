import { addDaysIso, daysBetweenIso, localDateTime, todayIso } from './dates';
import { doseLogId } from './schemas/doseLog';
import { DEFAULT_START_TIME, type MedicationData } from './schemas/medication';

/**
 * Cálculo dos horários das doses e dos avisos. Funções PURAS (sem Firebase, sem notificações), por isso
 * testadas a fundo. Os horários seguem o relógio de parede do aparelho (fuso local).
 *
 * REGRA DO PRODUTO: aqui só se calcula QUANDO lembrar do que o veterinário prescreveu. Nada é sugerido.
 */

export type Schedulable = Pick<MedicationData, 'frequency' | 'startDate' | 'startTime' | 'endDate' | 'status'>;

/** Janela móvel: o app agenda só o que vem pela frente e reagenda sempre que abre. */
export const REMINDER_WINDOW_HOURS = 72;
/** O iOS guarda no máximo 64 notificações locais agendadas; deixamos folga. */
export const MAX_SCHEDULED_REMINDERS = 60;
/** Hora dos avisos de fim de tratamento e de validade. */
export const ALERT_TIME = '09:00';
/** Quantos dias antes do vencimento o aviso é disparado. */
export const EXPIRY_WARNING_DAYS = 7;
/** Até quantos dias antes do vencimento a tela mostra "vence em breve". */
export const EXPIRY_BADGE_DAYS = 30;

const HOUR_MS = 3_600_000;
const MAX_DOSES_PER_CALL = 2000;

/** Instantes das doses de `from` até `to` (ambos inclusivos), em ordem. Só medicamentos "em uso" geram doses. */
export function doseTimesBetween(med: Schedulable, from: Date, to: Date): Date[] {
  if (med.status !== 'active' || to < from) return [];
  const out: Date[] = [];
  const lastDay = med.endDate; // inclusive; ausente = uso contínuo

  if (med.frequency.kind === 'interval') {
    const step = med.frequency.everyHours * HOUR_MS;
    const first = localDateTime(med.startDate, med.startTime ?? DEFAULT_START_TIME).getTime();
    let n = from.getTime() > first ? Math.ceil((from.getTime() - first) / step) : 0;
    for (; out.length < MAX_DOSES_PER_CALL; n += 1) {
      const at = new Date(first + n * step);
      if (at > to) break;
      if (lastDay && todayIso(at) > lastDay) break;
      out.push(at);
    }
    return out;
  }

  const times = [...med.frequency.times].sort();
  const fromDay = todayIso(from);
  const toDay = todayIso(to);
  let day = med.startDate > fromDay ? med.startDate : fromDay;
  for (; day <= toDay && (!lastDay || day <= lastDay) && out.length < MAX_DOSES_PER_CALL; day = addDaysIso(day, 1)) {
    for (const time of times) {
      const at = localDateTime(day, time);
      if (at >= from && at <= to) out.push(at);
    }
  }
  return out;
}

/** Próxima dose depois de `now` (ou null se o tratamento acabou / não está em uso). */
export function nextDose(med: Schedulable, now: Date): Date | null {
  const horizon = new Date(now.getTime() + 8 * 24 * HOUR_MS);
  const after = new Date(now.getTime() + 1);
  return doseTimesBetween(med, after, horizon)[0] ?? null;
}

/**
 * Doses que já deviam ter sido dadas (até `now`, e até `lookbackHours` atrás) e ainda NÃO foram registradas
 * como "dei" ou "pulei". São as que a tela oferece para registrar.
 */
export function dueDoses(
  medicationId: string,
  med: Schedulable,
  now: Date,
  loggedKeys: ReadonlySet<string>,
  lookbackHours = 24,
): Date[] {
  const from = new Date(now.getTime() - lookbackHours * HOUR_MS);
  return doseTimesBetween(med, from, now).filter((at) => !loggedKeys.has(doseLogId(medicationId, at)));
}

/* -------------------------------------------------------------------------- */
/*  Validade e fim do tratamento (telas)                                       */
/* -------------------------------------------------------------------------- */

export type ExpiryStatus = 'expired' | 'soon' | null;

export function expiryStatus(expiresOn: string | undefined, today: string = todayIso()): ExpiryStatus {
  if (!expiresOn) return null;
  if (expiresOn < today) return 'expired';
  return daysBetweenIso(today, expiresOn) <= EXPIRY_BADGE_DAYS ? 'soon' : null;
}

/** O tratamento tinha data final e ela já passou, mas o remédio continua "em uso". */
export function isTreatmentOver(med: Pick<MedicationData, 'endDate' | 'status'>, today: string = todayIso()): boolean {
  return med.status === 'active' && med.endDate !== undefined && med.endDate < today;
}

/* -------------------------------------------------------------------------- */
/*  Plano de lembretes (o que agendar nas notificações)                        */
/* -------------------------------------------------------------------------- */

export type ReminderKind = 'dose' | 'ends_tomorrow' | 'ends_today' | 'expires_soon' | 'expires_today';

export type ReminderItem = {
  kind: ReminderKind;
  petId: string;
  medicationId: string;
  at: Date;
  /** Doses: ID do registro de dose. Avisos: `${medicationId}_${kind}`. */
  key: string;
};

export type PlanMedication = { petId: string; id: string; med: MedicationData };

type PlanOptions = { windowHours?: number; max?: number };

function alertAt(iso: string): Date {
  return localDateTime(iso, ALERT_TIME);
}

/**
 * Monta a lista (já ordenada e limitada) do que deve estar agendado agora:
 * doses da janela móvel que ainda não foram registradas + avisos de fim de tratamento e de validade.
 */
export function buildReminderPlan(
  meds: readonly PlanMedication[],
  now: Date,
  loggedKeys: ReadonlySet<string>,
  { windowHours = REMINDER_WINDOW_HOURS, max = MAX_SCHEDULED_REMINDERS }: PlanOptions = {},
): ReminderItem[] {
  const until = new Date(now.getTime() + windowHours * HOUR_MS);
  const items: ReminderItem[] = [];
  const consider = (item: ReminderItem) => {
    if (item.at > now && item.at <= until) items.push(item);
  };

  for (const { petId, id, med } of meds) {
    if (med.status !== 'active') continue;

    for (const at of doseTimesBetween(med, new Date(now.getTime() + 1), until)) {
      const key = doseLogId(id, at);
      if (!loggedKeys.has(key)) consider({ kind: 'dose', petId, medicationId: id, at, key });
    }

    if (med.endDate) {
      consider({ kind: 'ends_today', petId, medicationId: id, at: alertAt(med.endDate), key: `${id}_ends_today` });
      if (med.endDate > med.startDate) {
        consider({
          kind: 'ends_tomorrow',
          petId,
          medicationId: id,
          at: alertAt(addDaysIso(med.endDate, -1)),
          key: `${id}_ends_tomorrow`,
        });
      }
    }

    if (med.expiresOn) {
      consider({ kind: 'expires_today', petId, medicationId: id, at: alertAt(med.expiresOn), key: `${id}_expires_today` });
      consider({
        kind: 'expires_soon',
        petId,
        medicationId: id,
        at: alertAt(addDaysIso(med.expiresOn, -EXPIRY_WARNING_DAYS)),
        key: `${id}_expires_soon`,
      });
    }
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
  return items.slice(0, max);
}
