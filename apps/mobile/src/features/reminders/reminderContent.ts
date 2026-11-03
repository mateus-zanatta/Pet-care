import type { ReminderItem, ReminderKind } from '@petcare/shared';

/** O que a notificação carrega para o app saber o que fazer ao tocar (sem dados além de IDs e horário). */
export type ReminderData = {
  kind: ReminderKind;
  petId: string;
  /** ID do medicamento, da vacina ou do evento de saúde. */
  refId: string;
  /** Doses: horário agendado em ISO UTC (chave do registro de dose). */
  scheduledFor?: string;
};

export type NotificationPayload = {
  id: string;
  at: Date;
  title: string;
  body: string;
  data: ReminderData;
};

export type ReminderLookupEntry = {
  petName: string;
  /** Nome do medicamento, da vacina ou título do evento. */
  name: string;
  /** Só medicamentos: dose "como prescrita". */
  doseAmount?: string;
  doseUnit?: string;
  expiresOn?: string;
};

export type ReminderLookup = ReadonlyMap<string, ReminderLookupEntry>;

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Chave do mapa de consulta: um item é identificado por pet + ID. */
export const lookupKey = (petId: string, refId: string) => `${petId}/${refId}`;

/**
 * Transforma o plano de lembretes em notificações já com texto no idioma da pessoa.
 * O texto repete a dose "como prescrita" e nunca sugere nada. `t` é o `t` do namespace "meds".
 */
export function buildPayloads(
  plan: readonly ReminderItem[],
  lookup: ReminderLookup,
  t: Translate,
  formatDate: (iso: string) => string,
): NotificationPayload[] {
  const payloads: NotificationPayload[] = [];
  for (const item of plan) {
    const info = lookup.get(lookupKey(item.petId, item.refId));
    if (!info) continue;
    const vars = {
      pet: info.petName,
      name: info.name,
      amount: info.doseAmount ?? '',
      unit: info.doseUnit ?? '',
      date: info.expiresOn ? formatDate(info.expiresOn) : '',
    };
    const data: ReminderData = { kind: item.kind, petId: item.petId, refId: item.refId };
    if (item.kind === 'dose') data.scheduledFor = item.at.toISOString();
    payloads.push({
      id: item.key,
      at: item.at,
      title: t(`notify.${item.kind}.title`, vars),
      body: t(`notify.${item.kind}.body`, vars),
      data,
    });
  }
  return payloads;
}

/** Resumo do que está agendado: se não mudou, não precisa reagendar tudo de novo. */
export function reminderSignature(payloads: readonly NotificationPayload[]): string {
  return payloads.map((p) => `${p.id}@${p.at.getTime()}|${p.title}|${p.body}`).join('\n');
}
