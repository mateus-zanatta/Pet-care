import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { putFile, ref as storageRef } from '@react-native-firebase/storage';
import {
  type AdoptionInput,
  type AdoptionListing,
  type AdoptionStatus,
  type AnimalReport,
  CENTRAL_STORAGE_ROOT,
  type CentralKind,
  MAX_CENTRAL_PHOTOS,
  type ReportInput,
  type RescueAlert,
  type RescueAlertInput,
  type RescueAlertStatus,
} from '@petcare/shared';
import { db, storage } from '@/core/firebase';
import { callFunction } from '@/core/firebase/callable';
import { prepareImageForUpload } from '@/core/media/image';
import type { PickedPhoto } from '@/features/pets/pets.repo';

/**
 * Centrais de adoção, resgate e denúncia. Gravações SÓ por Cloud Functions (validação + limite diário no
 * servidor); leitura direta do Firestore, com as regras decidindo quem vê o quê.
 */

/* --------------------------------- Leitura --------------------------------- */

type Raw = Record<string, unknown>;

function createdAtMs(data: Raw): number {
  const ts = data.createdAt as { toMillis?: () => number } | undefined;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : Date.now();
}

/** Documento -> objeto do app (tolerante: campo que faltar vira o padrão, nunca quebra a tela). */
export function parseCentral<T>(id: string, data: Raw): T {
  return { ...data, id, photoPaths: Array.isArray(data.photoPaths) ? data.photoPaths : [], createdAtMs: createdAtMs(data) } as T;
}

type Unsubscribe = () => void;
type OnError = (error: unknown) => void;

function listen<T>(q: ReturnType<typeof query>, onData: (items: T[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => parseCentral<T>(d.id, d.data() as Raw))),
    onError,
  );
}

/** Anúncios abertos (disponível ou reservado), mais novos primeiro. */
export function subscribeAdoptions(onData: (items: AdoptionListing[]) => void, onError: OnError): Unsubscribe {
  return listen(
    query(collection(db(), 'adoption_listings'), where('status', 'in', ['available', 'reserved']), orderBy('createdAt', 'desc'), limit(100)),
    onData,
    onError,
  );
}

export function subscribeMyAdoptions(uid: string, onData: (items: AdoptionListing[]) => void, onError: OnError): Unsubscribe {
  return listen(query(collection(db(), 'adoption_listings'), where('ownerId', '==', uid), orderBy('createdAt', 'desc')), onData, onError);
}

export function subscribeAdoption(id: string, onData: (item: AdoptionListing | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db(), 'adoption_listings', id),
    (snap) => onData(snap.exists() ? parseCentral<AdoptionListing>(snap.id, snap.data() as Raw) : null),
    onError,
  );
}

/** Telefone do anúncio (só quem tem conta consegue ler). */
export async function getAdoptionContact(id: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), 'adoption_listings', id, 'private', 'contact'));
  return snap.exists() ? ((snap.data()?.contactPhone as string | undefined) ?? null) : null;
}

export function subscribeOpenRescueAlerts(onData: (items: RescueAlert[]) => void, onError: OnError): Unsubscribe {
  return listen(
    query(collection(db(), 'rescue_alerts'), where('status', 'in', ['open', 'in_progress']), orderBy('createdAt', 'desc'), limit(100)),
    onData,
    onError,
  );
}

export function subscribeRescueAlert(id: string, onData: (item: RescueAlert | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db(), 'rescue_alerts', id),
    (snap) => onData(snap.exists() ? parseCentral<RescueAlert>(snap.id, snap.data() as Raw) : null),
    onError,
  );
}

export function subscribeMyReports(uid: string, onData: (items: AnimalReport[]) => void, onError: OnError): Unsubscribe {
  return listen(query(collection(db(), 'reports'), where('reporterId', '==', uid), orderBy('createdAt', 'desc')), onData, onError);
}

export function subscribeReport(id: string, onData: (item: AnimalReport | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db(), 'reports', id),
    (snap) => onData(snap.exists() ? parseCentral<AnimalReport>(snap.id, snap.data() as Raw) : null),
    onError,
  );
}

/* -------------------------------- Gravação -------------------------------- */

export const createAdoption = (input: AdoptionInput) => callFunction<AdoptionInput, { id: string }>('createAdoption', input);
export const updateAdoption = (input: { id: string; data?: Partial<AdoptionInput>; status?: AdoptionStatus; photoPaths?: string[] }) =>
  callFunction<typeof input, { ok: true }>('updateAdoption', input);
export const deleteAdoption = (id: string) => callFunction<{ id: string }, { ok: true }>('deleteAdoption', { id });

export const createRescueAlert = (input: RescueAlertInput) => callFunction<RescueAlertInput, { id: string }>('createRescueAlert', input);
export const updateRescueAlert = (input: { id: string; status?: RescueAlertStatus; photoPaths?: string[] }) =>
  callFunction<typeof input, { ok: true }>('updateRescueAlert', input);
export const deleteRescueAlert = (id: string) => callFunction<{ id: string }, { ok: true }>('deleteRescueAlert', { id });

export const createReport = (input: ReportInput) => callFunction<ReportInput, { id: string }>('createReport', input);
export const attachReportPhotos = (id: string, photoPaths: string[]) =>
  callFunction<{ id: string; photoPaths: string[] }, { ok: true }>('attachReportPhotos', { id, photoPaths });

/* ---------------------------------- Fotos ---------------------------------- */

/**
 * Envia as fotos NOVAS de um registro e devolve a lista final de caminhos (as já enviadas continuam).
 * PRIVACIDADE: cada foto é reduzida e recodificada como JPEG, o que descarta o EXIF (inclusive a localização GPS).
 */
export async function uploadCentralPhotos(kind: CentralKind, id: string, existing: readonly string[], photos: readonly PickedPhoto[]): Promise<string[]> {
  const paths = [...existing];
  for (const [index, photo] of photos.slice(0, Math.max(0, MAX_CENTRAL_PHOTOS - existing.length)).entries()) {
    const prepared = await prepareImageForUpload(photo.uri, photo.width, photo.height);
    const path = `${CENTRAL_STORAGE_ROOT[kind]}/${id}/photo-${Date.now()}-${index}.jpg`;
    await putFile(storageRef(storage(), path), prepared.uri.replace(/^file:\/\//, ''), { contentType: 'image/jpeg' });
    paths.push(path);
  }
  return paths;
}

export { getPhotoUrl } from '@/features/pets/pets.repo';
