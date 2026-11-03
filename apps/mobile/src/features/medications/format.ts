import { type MedicationData, todayIso } from '@petcare/shared';
import { formatIsoDate } from '@/core/dates';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** "08:05" a partir de um instante (relógio local, 24 h). */
export function formatClock(at: Date): string {
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** "A cada 8 h" ou "Todo dia às 08:00, 20:00". `t` é o `t` do namespace "meds". */
export function frequencySummary(frequency: MedicationData['frequency'], t: Translate): string {
  return frequency.kind === 'interval'
    ? t('frequency.summaryInterval', { hours: frequency.everyHours })
    : t('frequency.summaryFixed', { times: [...frequency.times].sort().join(', ') });
}

/** "hoje às 14:00", "amanhã às 08:00" ou "07/11 às 08:00". */
export function formatWhen(at: Date, now: Date, locale: 'pt-BR' | 'en', t: Translate): string {
  const time = formatClock(at);
  const day = todayIso(at);
  const today = todayIso(now);
  if (day === today) return t('when.today', { time });
  const tomorrow = todayIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (day === tomorrow) return t('when.tomorrow', { time });
  return t('when.other', { date: formatIsoDate(day, locale), time });
}
