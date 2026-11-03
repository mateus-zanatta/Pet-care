import { arrayRemove, arrayUnion, doc, serverTimestamp, updateDoc } from '@react-native-firebase/firestore';
import { deleteObject, getDownloadURL, putFile, ref as storageRef } from '@react-native-firebase/storage';
import {
  type AttachmentRef,
  type AttachmentType,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
  sanitizeAttachmentName,
} from '@petcare/shared';
import { File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { db, storage } from '@/core/firebase';
import { settleOrOffline } from '@/core/firebase/settle';
import { prepareImageForUpload } from '@/core/media/image';

export type AttachmentCollection = 'medications' | 'vaccines' | 'health_events';
export type AttachmentTarget = { collection: AttachmentCollection; petId: string; recordId: string };

export type AttachmentSource =
  | { kind: 'photo'; photo: { uri: string; width: number; height: number } }
  | { kind: 'pdf'; uri: string; name: string; size: number };

export class AttachmentError extends Error {
  constructor(public readonly code: 'unsupported' | 'too_large' | 'limit') {
    super(code);
    this.name = 'AttachmentError';
  }
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** ID curto e aleatório do anexo (parte do nome do arquivo no Storage). */
export function newAttachmentId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 20; i += 1) id += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
  return id;
}

const stripFileScheme = (uri: string) => uri.replace(/^file:\/\//, '');

function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

/** Abre o seletor de arquivos do sistema só para PDF. Devolve null se a pessoa cancelar. */
export async function pickPdf(): Promise<{ uri: string; name: string; size: number } | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/pdf'] });
  if (picked.canceled) return null;
  const file = picked.result;
  const isPdf = (file.type ?? '').toLowerCase() === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new AttachmentError('unsupported');
  const size = file.size ?? 0;
  if (size > MAX_ATTACHMENT_BYTES) throw new AttachmentError('too_large');
  return { uri: file.uri, name: file.name, size };
}

const todayStamp = (now: Date) =>
  `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

/**
 * Envia o arquivo para o Storage e o registra no documento (medicamento, vacina ou evento).
 * Fotos são reduzidas e recodificadas em JPEG (descarta a localização EXIF). Se o registro no documento
 * falhar, o arquivo enviado é removido para não ficar órfão.
 */
export async function addAttachment(
  target: AttachmentTarget,
  source: AttachmentSource,
  current: readonly AttachmentRef[],
  now: Date = new Date(),
): Promise<AttachmentRef> {
  if (current.length >= MAX_ATTACHMENTS) throw new AttachmentError('limit');

  const id = newAttachmentId();
  let contentType: AttachmentType;
  let localUri: string;
  let size: number;
  let name: string;

  if (source.kind === 'photo') {
    const prepared = await prepareImageForUpload(source.photo.uri, source.photo.width, source.photo.height);
    contentType = 'image/jpeg';
    localUri = prepared.uri;
    size = fileSize(prepared.uri);
    name = `foto-${todayStamp(now)}.jpg`;
  } else {
    if (source.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError('too_large');
    contentType = 'application/pdf';
    localUri = source.uri;
    size = source.size;
    name = sanitizeAttachmentName(source.name, 'documento.pdf');
  }

  const path = attachmentPath(target.petId, target.recordId, id, contentType);
  const fileRef = storageRef(storage(), path);
  await putFile(fileRef, stripFileScheme(localUri), { contentType });

  const attachment: AttachmentRef = { id, path, name, contentType, size, addedAt: now.toISOString() };
  try {
    // Se o servidor não confirmar a tempo (sem conexão), segue: o Firestore guarda e sincroniza depois.
    await settleOrOffline(
      updateDoc(doc(db(), 'pets', target.petId, target.collection, target.recordId), {
        attachments: arrayUnion(attachment),
        updatedAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    void deleteObject(fileRef).catch(() => undefined);
    throw error;
  }
  return attachment;
}

/** Remove o arquivo do Storage e a referência do documento. */
export async function removeAttachment(target: AttachmentTarget, attachment: AttachmentRef): Promise<void> {
  try {
    await deleteObject(storageRef(storage(), attachment.path));
  } catch (error) {
    // Já não existia no Storage: tudo certo, só falta limpar o documento.
    if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
  }
  await settleOrOffline(
    updateDoc(doc(db(), 'pets', target.petId, target.collection, target.recordId), {
      attachments: arrayRemove(attachment),
      updatedAt: serverTimestamp(),
    }),
  );
}

/** Abre o anexo (foto ou PDF) no navegador do sistema, com um link temporário do Storage. */
export async function openAttachment(attachment: AttachmentRef): Promise<void> {
  const url = await getDownloadURL(storageRef(storage(), attachment.path));
  await WebBrowser.openBrowserAsync(url);
}

/** Apaga todos os arquivos de um registro (ao excluir o medicamento/vacina/evento). Falhas isoladas não impedem a exclusão. */
export async function deleteAllAttachmentFiles(attachments: readonly AttachmentRef[] | undefined): Promise<void> {
  await Promise.all(
    (attachments ?? []).map((a) => deleteObject(storageRef(storage(), a.path)).catch(() => undefined)),
  );
}
