import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import type { HealthEvent, HealthEventData, Vaccine, VaccineData } from '@petcare/shared';
import { db } from '@/core/firebase';
import { settleOrOffline } from '@/core/firebase/settle';
import { buildHealthEventUpdate, buildVaccineUpdate, parseHealthEvent, parseVaccine } from './health.mapper';

type Status = 'committed' | 'pending';

/* --------------------------------- Vacinas --------------------------------- */

export async function createVaccine(petId: string, uid: string, data: VaccineData): Promise<{ id: string; status: Status }> {
  const ref = doc(collection(db(), 'pets', petId, 'vaccines'));
  const status = await settleOrOffline(
    setDoc(ref, { ...data, createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
  return { id: ref.id, status };
}

export function updateVaccine(petId: string, id: string, data: VaccineData): Promise<Status> {
  return settleOrOffline(
    updateDoc(doc(db(), 'pets', petId, 'vaccines', id), { ...buildVaccineUpdate(data, deleteField()), updatedAt: serverTimestamp() }),
  );
}

export function deleteVaccine(petId: string, id: string): Promise<void> {
  return deleteDoc(doc(db(), 'pets', petId, 'vaccines', id));
}

export function subscribeVaccines(petId: string, onData: (items: Vaccine[]) => void, onError: (error: unknown) => void) {
  return onSnapshot(
    collection(db(), 'pets', petId, 'vaccines'),
    (snap) => onData(snap.docs.map((d) => parseVaccine(d.id, d.data())).filter((v): v is Vaccine => v !== null)),
    onError,
  );
}

/* ---------------------------- Eventos de saúde ---------------------------- */

export async function createHealthEvent(petId: string, uid: string, data: HealthEventData): Promise<{ id: string; status: Status }> {
  const ref = doc(collection(db(), 'pets', petId, 'health_events'));
  const status = await settleOrOffline(
    setDoc(ref, { ...data, createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
  return { id: ref.id, status };
}

export function updateHealthEvent(petId: string, id: string, data: HealthEventData): Promise<Status> {
  return settleOrOffline(
    updateDoc(doc(db(), 'pets', petId, 'health_events', id), { ...buildHealthEventUpdate(data, deleteField()), updatedAt: serverTimestamp() }),
  );
}

export function deleteHealthEvent(petId: string, id: string): Promise<void> {
  return deleteDoc(doc(db(), 'pets', petId, 'health_events', id));
}

export function subscribeHealthEvents(petId: string, onData: (items: HealthEvent[]) => void, onError: (error: unknown) => void) {
  return onSnapshot(
    collection(db(), 'pets', petId, 'health_events'),
    (snap) => onData(snap.docs.map((d) => parseHealthEvent(d.id, d.data())).filter((e): e is HealthEvent => e !== null)),
    onError,
  );
}
