import { z } from 'zod';

/** Tipos de anexo aceitos: fotos (sempre recodificadas em JPEG, o que descarta a localização EXIF) e PDF. */
export const ATTACHMENT_TYPES = ['image/jpeg', 'application/pdf'] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Referência a um arquivo no Storage, guardada dentro do documento a que ele pertence. */
export const attachmentRefSchema = z.object({
  id: z.string().min(1).max(40),
  path: z.string().min(1).max(300),
  name: z.string().min(1).max(80),
  contentType: z.enum(ATTACHMENT_TYPES),
  size: z.number().int().min(0).max(MAX_ATTACHMENT_BYTES),
  /** Instante do envio, ISO 8601 UTC. */
  addedAt: z.string().datetime(),
});
export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

export const attachmentExtension = (contentType: AttachmentType): string => (contentType === 'application/pdf' ? 'pdf' : 'jpg');

/** `pets/{petId}/attachments/{recordId}/{attachmentId}.ext` — as regras do Storage liberam tudo sob `pets/{petId}/` aos membros. */
export function attachmentPath(petId: string, recordId: string, attachmentId: string, contentType: AttachmentType): string {
  return `pets/${petId}/attachments/${recordId}/${attachmentId}.${attachmentExtension(contentType)}`;
}

/** Nome para exibição: sem pastas, sem caracteres de controle, no máximo 80 caracteres. */
export function sanitizeAttachmentName(name: string, fallback = 'arquivo'): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- remover caracteres de controle é justamente o objetivo
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || fallback).slice(0, 80);
}
