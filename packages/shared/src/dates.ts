/** Utilitários de data sem dependências. Datas "de calendário" são strings ISO `YYYY-MM-DD`. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** Data de hoje no fuso local do aparelho, em ISO. `now` existe para facilitar testes. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Compara strings ISO (a ordem lexicográfica coincide com a cronológica). */
export function isAfterIso(a: string, b: string): boolean {
  return a > b;
}

/** Meses completos entre duas datas ISO (`from` <= `to`). Retorna 0 se `to` for anterior. */
export function monthsBetween(from: string, to: string): number {
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) return 0;
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number];
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return Math.max(0, months);
}
