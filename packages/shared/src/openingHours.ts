/**
 * Horário de funcionamento no formato do OpenStreetMap (`opening_hours`), só o SUBCONJUNTO mais comum:
 *   "24/7" · "Mo-Fr 08:00-18:00" · "Mo-Fr 08:00-12:00,14:00-18:00; Sa 08:00-12:00; Su off" · "18:00-02:00"
 * Qualquer coisa fora disso (meses, feriados com data, "sunrise", comentários...) vira "não sei" (null):
 * nesse caso o app NÃO afirma que está aberto ou fechado.
 */

/** Minutos desde 00:00; o fim pode passar de 1440 (ex.: 18:00-02:00 vira 1080-1560). */
export type Span = { start: number; end: number };
/** Índice 0 = segunda ... 6 = domingo. */
export type WeekHours = { alwaysOpen: boolean; days: Span[][] };

const DAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
const TIME = /^([01]?\d|2[0-4]):([0-5]\d)$/;

function parseTime(text: string): number | null {
  const m = TIME.exec(text.trim());
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes > 1440 ? null : minutes;
}

function parseSpan(text: string): Span | null {
  const parts = text.split('-');
  if (parts.length !== 2) return null;
  const start = parseTime(parts[0]!);
  let end = parseTime(parts[1]!);
  if (start === null || end === null || start >= 1440) return null;
  if (end <= start) end += 1440; // atravessa a meia-noite
  return { start, end };
}

/** "Mo-Fr,Su" -> [0,1,2,3,4,6]; null se não entender; "skip" para feriados (PH/SH), que não conseguimos avaliar. */
function parseDays(text: string): number[] | 'skip' | null {
  const result = new Set<number>();
  for (const part of text.split(',')) {
    const p = part.trim().toLowerCase();
    if (p === 'ph' || p === 'sh') return 'skip';
    const range = p.split('-');
    if (range.length === 1) {
      const i = DAYS.indexOf(p as (typeof DAYS)[number]);
      if (i < 0) return null;
      result.add(i);
    } else if (range.length === 2) {
      const a = DAYS.indexOf(range[0] as (typeof DAYS)[number]);
      const b = DAYS.indexOf(range[1] as (typeof DAYS)[number]);
      if (a < 0 || b < 0) return null;
      for (let i = a; ; i = (i + 1) % 7) {
        result.add(i);
        if (i === b) break;
      }
    } else return null;
  }
  return [...result];
}

const isDaySelector = (token: string) => /^[A-Za-z]{2}(-[A-Za-z]{2})?(,[A-Za-z]{2}(-[A-Za-z]{2})?)*$/.test(token);

export function parseOpeningHours(raw: string | undefined | null): WeekHours | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text === '') return null;
  if (/^24\/7$/i.test(text)) return { alwaysOpen: true, days: DAYS.map(() => [{ start: 0, end: 1440 }]) };

  const days: Span[][] = DAYS.map(() => []);
  let understood = false;

  for (const ruleRaw of text.split(/;|\|\|/)) {
    const rule = ruleRaw.trim();
    if (rule === '') continue;
    const firstSpace = rule.indexOf(' ');
    const head = firstSpace < 0 ? rule : rule.slice(0, firstSpace);
    const tail = firstSpace < 0 ? '' : rule.slice(firstSpace + 1).trim();

    let selected: number[];
    let timesText: string;
    if (isDaySelector(head)) {
      const parsed = parseDays(head);
      if (parsed === null) return null;
      if (parsed === 'skip') continue; // regra de feriado: ignorada
      selected = parsed;
      timesText = tail;
    } else {
      selected = [0, 1, 2, 3, 4, 5, 6]; // só horários: vale todos os dias
      timesText = rule;
    }

    if (/^(off|closed)$/i.test(timesText)) {
      for (const d of selected) days[d] = [];
      understood = true;
      continue;
    }
    if (/^24\/7$/i.test(timesText)) {
      for (const d of selected) days[d] = [{ start: 0, end: 1440 }];
      understood = true;
      continue;
    }
    const spans: Span[] = [];
    for (const piece of timesText.split(',')) {
      const span = parseSpan(piece);
      if (!span) return null;
      spans.push(span);
    }
    if (spans.length === 0) return null;
    // Semântica do OSM: uma regra posterior SUBSTITUI os horários dos dias que ela cita.
    for (const d of selected) days[d] = spans;
    understood = true;
  }

  if (!understood) return null;
  const alwaysOpen = days.every((spans) => spans.some((s) => s.start === 0 && s.end >= 1440));
  return { alwaysOpen, days };
}

/** Índice do dia no padrão do OSM (0 = segunda) a partir de uma data local. */
const osmDayIndex = (date: Date) => (date.getDay() + 6) % 7;

/** true/false se der para saber; null se o horário não for entendido. Usa o relógio LOCAL do aparelho. */
export function isOpenAt(raw: string | undefined | null, date: Date): boolean | null {
  const week = parseOpeningHours(raw);
  if (!week) return null;
  if (week.alwaysOpen) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const today = osmDayIndex(date);
  if (week.days[today]!.some((s) => minutes >= s.start && minutes < s.end)) return true;
  // Horário de ontem que atravessou a meia-noite (ex.: 18:00-02:00).
  const yesterday = (today + 6) % 7;
  return week.days[yesterday]!.some((s) => s.end > 1440 && minutes + 1440 < s.end);
}

export const isAlwaysOpen = (raw: string | undefined | null): boolean => parseOpeningHours(raw)?.alwaysOpen ?? false;
