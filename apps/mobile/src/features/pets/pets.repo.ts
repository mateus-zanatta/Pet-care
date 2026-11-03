import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  putFile,
  ref as storageRef,
  uploadString,
} from '@react-native-firebase/storage';
import {
  type Pet,
  type PetData,
  type PetMember,
  type PetOrigin,
  type SinpatinhasMeta,
  petMemberId,
} from '@petcare/shared';
import { db, storage } from '@/core/firebase';
import { callFunction } from '@/core/firebase/callable';
import { settleOrOffline } from '@/core/firebase/settle';
import { prepareImageForUpload } from '@/core/media/image';
import { buildPetUpdate, parseMember, parsePet } from './pets.mapper';

/* ------------------------------- Escrita ------------------------------- */

/** Dados que só chegam pela importação do RG Animal (o tutor só entra se a pessoa confirmar). */
export type PetExtra = {
  sinpatinhas?: SinpatinhasMeta;
  tutor?: { nome?: string; telefone?: string };
};

export type CreatePetInput = {
  uid: string;
  displayName: string | null;
  data: PetData;
  origin?: PetOrigin;
  extra?: PetExtra;
};

/** Cria o pet e o vínculo de dono no MESMO lote (as regras de segurança exigem os dois). */
export async function createPet({ uid, displayName, data, origin = 'manual', extra }: CreatePetInput) {
  const petRef = doc(collection(db(), 'pets'));
  const batch = writeBatch(db());
  batch.set(petRef, {
    ...data,
    ...(extra?.sinpatinhas ? { sinpatinhas: extra.sinpatinhas } : {}),
    ...(extra?.tutor ? { tutor: extra.tutor } : {}),
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

export async function updatePet(petId: string, data: PetData, extra?: PetExtra) {
  const write = updateDoc(doc(db(), 'pets', petId), {
    ...buildPetUpdate(data, deleteField()),
    ...(extra?.sinpatinhas ? { sinpatinhas: extra.sinpatinhas } : {}),
    ...(extra?.tutor ? { tutor: extra.tutor } : {}),
    updatedAt: serverTimestamp(),
  });
  return settleOrOffline(write);
}

/** Exclusão completa (pet, saúde, vínculos e arquivos) feita pelo servidor. */
export async function deletePet(petId: string): Promise<void> {
  await callFunction<{ petId: string }, { ok: true }>('deletePet', { petId });
}

/* -------------------------------- Foto -------------------------------- */

/** `base64`: foto já pronta (JPEG limpo, sem EXIF) que dispensa arquivo local, como a lida do RG Animal. */
export type PickedPhoto = { uri: string; width: number; height: number; base64?: string };

const photoPath = (petId: string) => `pets/${petId}/profile.jpg`;

/** Reduz, remove a localização (EXIF) e envia a foto de perfil. */
export async function uploadPetPhoto(petId: string, photo: PickedPhoto): Promise<void> {
  const target = storageRef(storage(), photoPath(petId));
  if (photo.base64) {
    // Já é um JPEG reduzido e sem metadados (gerado pelo servidor): envia direto.
    await uploadString(target, photo.base64, 'base64', { contentType: 'image/jpeg' });
  } else {
    const prepared = await prepareImageForUpload(photo.uri, photo.width, photo.height);
    const localPath = prepared.uri.replace(/^file:\/\//, '');
    await putFile(target, localPath, { contentType: 'image/jpeg' });
  }
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

/* ------------------------------ Consultas ------------------------------ */

/**
 * Procura, entre os pets que a pessoa pode editar, um com o mesmo RGA. Não existe "listar todos os
 * pets" (as regras não deixam): parte dos vínculos da própria pessoa e lê cada pet pelo ID.
 */
export async function findPetByRga(uid: string, rga: string): Promise<Pet | null> {
  const memberships = await getDocs(query(collection(db(), 'pet_members'), where('uid', '==', uid)));
  for (const member of memberships.docs) {
    const { petId, role } = member.data() as { petId?: string; role?: string };
    if (!petId || role === 'viewer') continue;
    const snap = await getDoc(doc(db(), 'pets', petId));
    const pet = snap.exists() ? parsePet(snap.id, snap.data()) : null;
    if (pet && pet.rga === rga) return pet;
  }
  return null;
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
