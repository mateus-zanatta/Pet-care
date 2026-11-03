import type { HealthEvent } from './schemas/healthEvent';
import type { Vaccine } from './schemas/vaccine';

export type TimelineItem =
  | { kind: 'vaccine'; id: string; date: string; title: string; nextOn?: string; hasAttachments: boolean }
  | { kind: 'event'; id: string; date: string; title: string; type: HealthEvent['type']; nextOn?: string; hasAttachments: boolean };

/** Junta vacinas e eventos numa única linha do tempo, da data mais recente para a mais antiga. */
export function buildTimeline(vaccines: readonly Vaccine[], events: readonly HealthEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...vaccines.map((v): TimelineItem => ({
      kind: 'vaccine',
      id: v.id,
      date: v.appliedOn,
      title: v.name,
      nextOn: v.nextDoseOn,
      hasAttachments: (v.attachments?.length ?? 0) > 0,
    })),
    ...events.map((e): TimelineItem => ({
      kind: 'event',
      id: e.id,
      date: e.date,
      title: e.title,
      type: e.type,
      nextOn: e.nextDate,
      hasAttachments: (e.attachments?.length ?? 0) > 0,
    })),
  ];
  // ISO ordena como texto; empate desfeito por tipo e ID para a ordem ser estável.
  return items.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

/** Datas combinadas para o futuro (próxima vacina, próximo vermífugo...), da mais próxima à mais distante. */
export function upcomingDues(items: readonly TimelineItem[], today: string): TimelineItem[] {
  return items
    .filter((i) => i.nextOn !== undefined && i.nextOn >= today)
    .sort((a, b) => (a.nextOn ?? '').localeCompare(b.nextOn ?? '') || a.id.localeCompare(b.id));
}
