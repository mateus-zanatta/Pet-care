import {
  CONTINUATION_FIELDS,
  CONTINUATION_MAX_GAP,
  POSITION_TOLERANCE,
  RGA_POSITIONS,
  type RawFieldKey,
} from './positions';
import type { TextItem } from './textItems';

export type RawFields = Partial<Record<RawFieldKey, string>>;
export type MapResult = {
  raw: RawFields;
  /** Itens fora de qualquer posição conhecida (ignorados). */
  ignored: number;
  /** Itens que caíram em um campo já preenchido (o primeiro vale). */
  duplicates: number;
};

const FIELD_KEYS = Object.keys(RGA_POSITIONS) as RawFieldKey[];

/** Campo cuja posição está a ±tolerância do item (o mais próximo), ou null. */
function nearestField(item: TextItem): RawFieldKey | null {
  let best: { key: RawFieldKey; distance: number } | null = null;
  for (const key of FIELD_KEYS) {
    const pos = RGA_POSITIONS[key];
    const dx = Math.abs(item.x - pos.x);
    const dy = Math.abs(item.y - pos.y);
    if (dx > POSITION_TOLERANCE || dy > POSITION_TOLERANCE) continue;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { key, distance };
  }
  return best?.key ?? null;
}

/** Campo (de texto longo) do qual o item é a linha seguinte, ou null. */
function continuationOf(item: TextItem): RawFieldKey | null {
  for (const key of CONTINUATION_FIELDS) {
    const pos = RGA_POSITIONS[key];
    const gap = pos.y - item.y; // positivo = abaixo do campo
    if (Math.abs(item.x - pos.x) <= POSITION_TOLERANCE && gap > POSITION_TOLERANCE && gap <= CONTINUATION_MAX_GAP) {
      return key;
    }
  }
  return null;
}

const clean = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * Distribui os itens de texto pelos campos do RG Animal usando só a POSIÇÃO.
 * Item que não casa com nenhuma posição: se está logo abaixo do nome ou do responsável, é a
 * continuação de um nome longo que quebrou linha; senão é ignorado (e contado, para avisar).
 */
export function mapRgaFields(items: readonly TextItem[]): MapResult {
  const raw: RawFields = {};
  const continuations = new Map<RawFieldKey, TextItem[]>();
  let ignored = 0;
  let duplicates = 0;

  for (const item of items) {
    const text = clean(item.text);
    if (text === '') continue;

    const key = nearestField(item);
    if (key) {
      if (raw[key] === undefined) raw[key] = text;
      else duplicates += 1;
      continue;
    }

    const parent = continuationOf(item);
    if (parent) {
      const list = continuations.get(parent) ?? [];
      list.push({ ...item, text });
      continuations.set(parent, list);
      continue;
    }

    ignored += 1;
  }

  for (const [parent, lines] of continuations) {
    const base = raw[parent];
    if (base === undefined) {
      ignored += lines.length; // continuação órfã
      continue;
    }
    const extra = [...lines].sort((a, b) => b.y - a.y || a.x - b.x).map((l) => l.text);
    raw[parent] = [base, ...extra].join(' ');
  }

  return { raw, ignored, duplicates };
}
