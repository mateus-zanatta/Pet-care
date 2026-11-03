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
/** Avisos (fim de tratamento, validade, próxima vacina...) são poucos: agendamos com mais antecedência que as doses. */
export const ALERT_WINDOW_DAYS = 30;
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

export type ReminderKind =
  | 'dose'
  | 'ends_tomorrow'
  | 'ends_today'
  | 'expires_soon'
  | 'expires_today'
  | 'vaccine_tomorrow'
  | 'vaccine_today'
  | 'event_tomorrow'
  | 'event_today';

export type ReminderItem = {
  kind: ReminderKind;
  petId: string;
  /** ID do medicamento, da vacina ou do evento de saúde a que o lembrete se refere. */
  refId: string;
  at: Date;
  /** Doses: ID do registro de dose. Avisos: `${refId}_${kind}`. */
  key: string;
};

export type PlanMedication = { petId: string; id: string; med: MedicationData };

/** Data combinada para algo acontecer de novo (próxima dose de vacina, próximo vermífugo...). */
export type PlanDue = { petId: string; id: string; source: 'vaccine' | 'event'; dueOn: string };

type PlanOptions = { windowHours?: number; max?: number; alertDays?: number; dues?: readonly PlanDue[] };

function alertAt(iso: string): Date {
  return localDateTime(iso, ALERT_TIME);
}

/**
 * Monta a lista (já ordenada e limitada) do que deve estar agendado agora:
 * - doses da janela móvel (72 h) que ainda não foram registradas;
 * - avisos de fim de tratamento e de validade dos medicamentos;
 * - avisos de "próxima dose" de vacinas e de eventos de saúde (véspera e dia, às 09:00).
 * Os avisos olham mais longe (30 dias) que as doses, porque são poucos.
 */
export function buildReminderPlan(
  meds: readonly PlanMedication[],
  now: Date,
  loggedKeys: ReadonlySet<string>,
  { windowHours = REMINDER_WINDOW_HOURS, max = MAX_SCHEDULED_REMINDERS, alertDays = ALERT_WINDOW_DAYS, dues = [] }: PlanOptions = {},
): ReminderItem[] {
  const doseUntil = new Date(now.getTime() + windowHours * HOUR_MS);
  const alertUntil = new Date(now.getTime() + alertDays * 24 * HOUR_MS);
  const items: ReminderItem[] = [];
  const consider = (item: ReminderItem, until: Date) => {
    if (item.at > now && item.at <= until) items.push(item);
  };
  const alert = (kind: ReminderKind, petId: string, refId: string, day: string) =>
    consider({ kind, petId, refId, at: alertAt(day), key: `${refId}_${kind}` }, alertUntil);

  for (const { petId, id, med } of meds) {
    if (med.status !== 'active') continue;

    for (const at of doseTimesBetween(med, new Date(now.getTime() + 1), doseUntil)) {
      const key = doseLogId(id, at);
      if (!loggedKeys.has(key)) consider({ kind: 'dose', petId, refId: id, at, key }, doseUntil);
    }

    if (med.endDate) {
      alert('ends_today', petId, id, med.endDate);
      if (med.endDate > med.startDate) alert('ends_tomorrow', petId, id, addDaysIso(med.endDate, -1));
    }

    if (med.expiresOn) {
      alert('expires_today', petId, id, med.expiresOn);
      alert('expires_soon', petId, id, addDaysIso(med.expiresOn, -EXPIRY_WARNING_DAYS));
    }
  }

  for (const { petId, id, source, dueOn } of dues) {
    alert(`${source}_today`, petId, id, dueOn);
    alert(`${source}_tomorrow`, petId, id, addDaysIso(dueOn, -1));
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
  return items.slice(0, max);
}
