import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { httpsCallable } from '@react-native-firebase/functions';
import {
  deleteObject,
  getDownloadURL,
  putFile,
  ref as storageRef,
} from '@react-native-firebase/storage';
import { type Pet, type PetData, type PetMember, type PetOrigin, petMemberId } from '@petcare/shared';
import { db, functions, storage } from '@/core/firebase';
import { prepareImageForUpload } from '@/core/media/image';
import { buildPetUpdate, parseMember, parsePet } from './pets.mapper';

/* ------------------------------- Escrita ------------------------------- */

/** Espera a gravação confirmada; sem internet, segue em frente (o Firestore sincroniza depois). */
async function settleOrOffline(write: Promise<unknown>, timeoutMs = 10_000): Promise<'committed' | 'pending'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'pending'>((resolve) => {
    timer = setTimeout(() => resolve('pending'), timeoutMs);
  });
  try {
    return await Promise.race([write.then(() => 'committed' as const), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type CreatePetInput = {
  uid: string;
  displayName: string | null;
  data: PetData;
  origin?: PetOrigin;
};

/** Cria o pet e o vínculo de dono no MESMO lote (as regras de segurança exigem os dois). */
export async function createPet({ uid, displayName, data, origin = 'manual' }: CreatePetInput) {
  const petRef = doc(collection(db(), 'pets'));
  const batch = writeBatch(db());
  batch.set(petRef, {
    ...data,
    ownerId: uid,
    origin,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db(), 'pet_members', petMemberId(petRef.id, uid)), {
    petId: petRef.id,
    uid,
    role: 'owner',
    ...(displayName ? { displayName } : {}),
    addedAt: serverTimestamp(),
  });
  const status = await settleOrOffline(batch.commit());
  return { petId: petRef.id, status };
}

export async function updatePet(petId: string, data: PetData) {
  const write = updateDoc(doc(db(), 'pets', petId), {
    ...buildPetUpdate(data, deleteField()),
    updatedAt: serverTimestamp(),
  });
  return settleOrOffline(write);
}

/** Exclusão completa (pet, saúde, vínculos e arquivos) feita pelo servidor. */
export async function deletePet(petId: string): Promise<void> {
  await httpsCallable<{ petId: string }, { ok: true }>(functions(), 'deletePet')({ petId });
}

/* -------------------------------- Foto -------------------------------- */

export type PickedPhoto = { uri: string; width: number; height: number };

const photoPath = (petId: string) => `pets/${petId}/profile.jpg`;

/** Reduz, remove a localização (EXIF) e envia a foto de perfil. */
export async function uploadPetPhoto(petId: string, photo: PickedPhoto): Promise<void> {
  const prepared = await prepareImageForUpload(photo.uri, photo.width, photo.height);
  const localPath = prepared.uri.replace(/^file:\/\//, '');
  await putFile(storageRef(storage(), photoPath(petId)), localPath, { contentType: 'image/jpeg' });
  await updateDoc(doc(db(), 'pets', petId), {
    photoPath: photoPath(petId),
    photoUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removePetPhoto(petId: string): Promise<void> {
  try {
    await deleteObject(storageRef(storage(), photoPath(petId)));
  } catch (error) {
    // Já não existia no Storage: tudo certo, só falta limpar o documento.
    if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
  }
  await updateDoc(doc(db(), 'pets', petId), {
    photoPath: deleteField(),
    photoUpdatedAt: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

const urlCache = new Map<string, Promise<string>>();

/** URL de exibição da foto; `version` renova o cache quando a foto muda. */
export function getPhotoUrl(path: string, version: number): Promise<string> {
  const key = `${path}:${version}`;
  let cached = urlCache.get(key);
  if (!cached) {
    cached = getDownloadURL(storageRef(storage(), path));
    cached.catch(() => urlCache.delete(key));
    urlCache.set(key, cached);
  }
  return cached;
}

/* ------------------------------ Assinaturas ------------------------------ */

export function subscribeMemberships(
  uid: string,
  onData: (members: PetMember[]) => void,
  onError: (error: unknown) => void,
) {
  const q = query(collection(db(), 'pet_members'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const members = snap.docs.map((d) => parseMember(d.data())).filter((m): m is PetMember => m !== null);
      onData(members);
    },
    onError,
  );
}

export function subscribePet(
  petId: string,
  onData: (pet: Pet | null) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    doc(db(), 'pets', petId),
    (snap) => onData(snap.exists() ? parsePet(snap.id, snap.data()) : null),
    onError,
  );
}
