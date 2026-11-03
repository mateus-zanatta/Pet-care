import { type AppLocale, isValidIsoDate } from '@petcare/shared';

/** Ordem dos campos numa data digitada: português = dia/mês/ano; inglês = mês/dia/ano. */
export type DateOrder = 'DMY' | 'MDY';

export const dateOrderFor = (locale: AppLocale): DateOrder => (locale === 'en' ? 'MDY' : 'DMY');

/** Mantém só dígitos e insere as barras: "03112026" -> "03/11/2026". */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export const INVALID_DATE = 'invalid';

/**
 * Converte o texto digitado em ISO (`YYYY-MM-DD`).
 * Vazio -> ''. Completo e válido -> ISO. Qualquer outra coisa -> 'invalid'
 * (o schema Zod transforma isso na mensagem de erro).
 */
export function parseDateInput(text: string, order: DateOrder): string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return INVALID_DATE;
  const [, a, b, year] = match as unknown as [string, string, string, string];
  const [day, month] = order === 'DMY' ? [a, b] : [b, a];
  const iso = `${year}-${month}-${day}`;
  return isValidIsoDate(iso) ? iso : INVALID_DATE;
}

/** ISO -> texto no formato do idioma. Entradas inválidas viram ''. */
export function isoToInput(iso: string, order: DateOrder): string {
  if (!isValidIsoDate(iso)) return '';
  const [year, month, day] = iso.split('-') as [string, string, string];
  return order === 'DMY' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

/** Data legível para exibição (usa Intl do aparelho). */
export function formatIsoDate(iso: string, locale: AppLocale): string {
  if (!isValidIsoDate(iso)) return iso;
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
