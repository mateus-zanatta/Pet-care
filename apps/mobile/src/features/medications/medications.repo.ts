import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import {
  type DoseLog,
  type DoseOutcome,
  type Medication,
  type MedicationData,
  type MedicationStatus,
  doseLogId,
} from '@petcare/shared';
import { db } from '@/core/firebase';
import { settleOrOffline } from '@/core/firebase/settle';
import { buildMedicationUpdate, parseDoseLog, parseMedication } from './medications.mapper';

const medsCol = (petId: string) => collection(db(), 'pets', petId, 'medications');
const logsCol = (petId: string) => collection(db(), 'pets', petId, 'dose_logs');

/* ------------------------------- Medicamentos ------------------------------- */

/** O ID é gerado aqui para a tela poder abrir o medicamento mesmo sem confirmação do servidor. */
export async function createMedication(
  petId: string,
  uid: string,
  data: MedicationData,
): Promise<{ id: string; status: 'committed' | 'pending' }> {
  const ref = doc(medsCol(petId));
  const status = await settleOrOffline(
    setDoc(ref, { ...data, createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  );
  return { id: ref.id, status };
}

export async function updateMedication(petId: string, medId: string, data: MedicationData) {
  return settleOrOffline(
    updateDoc(doc(db(), 'pets', petId, 'medications', medId), {
      ...buildMedicationUpdate(data, deleteField()),
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function setMedicationStatus(petId: string, medId: string, status: MedicationStatus) {
  return settleOrOffline(
    updateDoc(doc(db(), 'pets', petId, 'medications', medId), { status, updatedAt: serverTimestamp() }),
  );
}

export async function deleteMedication(petId: string, medId: string): Promise<void> {
  await deleteDoc(doc(db(), 'pets', petId, 'medications', medId));
}

export function subscribeMedications(
  petId: string,
  onData: (items: Medication[]) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    medsCol(petId),
    (snap) => onData(snap.docs.map((d) => parseMedication(d.id, d.data())).filter((m): m is Medication => m !== null)),
    onError,
  );
}

/* --------------------------------- Doses ---------------------------------- */

export type LogDoseInput = {
  petId: string;
  medicationId: string;
  scheduledFor: Date;
  outcome: DoseOutcome;
  uid: string;
  displayName: string | null;
  /** Horário real do registro (relógio do aparelho). */
  now?: Date;
};

/**
 * Registra "Dei a dose" ou "Pulei". O ID é determinístico (remédio + minuto agendado): registrar a mesma dose
 * duas vezes (toque duplo, notificação e app) apenas atualiza o mesmo registro.
 */
export async function logDose({ petId, medicationId, scheduledFor, outcome, uid, displayName, now = new Date() }: LogDoseInput) {
  const id = doseLogId(medicationId, scheduledFor);
  const status = await settleOrOffline(
    setDoc(doc(db(), 'pets', petId, 'dose_logs', id), {
      medicationId,
      scheduledFor: scheduledFor.toISOString(),
      outcome,
      actualAt: now.toISOString(),
      byUid: uid,
      ...(displayName ? { byName: displayName.slice(0, 80) } : {}),
      createdAt: serverTimestamp(),
    }),
  );
  return { id, status };
}

/** Desfaz um registro feito por engano. */
export async function undoDose(petId: string, logId: string): Promise<void> {
  await deleteDoc(doc(db(), 'pets', petId, 'dose_logs', logId));
}

/** Registros de dose a partir de `sinceIso` (ISO UTC; a ordem do texto coincide com a cronológica). */
export function subscribeDoseLogs(
  petId: string,
  sinceIso: string,
  onData: (items: DoseLog[]) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    query(logsCol(petId), where('scheduledFor', '>=', sinceIso), orderBy('scheduledFor', 'desc')),
    (snap) => onData(snap.docs.map((d) => parseDoseLog(d.id, d.data())).filter((l): l is DoseLog => l !== null)),
    onError,
  );
}
