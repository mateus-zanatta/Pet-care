import {
  PET_FORM_OPTIONAL_KEYS,
  type Pet,
  type PetData,
  type PetMember,
  petDocSchema,
  petMemberSchema,
} from '@petcare/shared';

/** Lê um documento do Firestore como Pet; documentos corrompidos viram null (e são ignorados). */
export function parsePet(id: string, data: unknown): Pet | null {
  const parsed = petDocSchema.safeParse(data);
  return parsed.success ? { id, ...parsed.data } : null;
}

export function parseMember(data: unknown): PetMember | null {
  const parsed = petMemberSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * Monta o objeto de atualização de um pet. Os campos opcionais que o usuário apagou no
 * formulário viram `removeMarker` (deleteField do Firestore), em vez de ficarem para trás.
 * Não toca em campos que o formulário não controla (dono, foto, dados do SinPatinhas...).
 */
export function buildPetUpdate<M>(data: PetData, removeMarker: M): Record<string, unknown> {
  const update: Record<string, unknown> = {
    name: data.name,
    species: data.species,
    sex: data.sex,
    neutered: data.neutered,
  };
  for (const key of PET_FORM_OPTIONAL_KEYS) {
    update[key] = data[key] ?? removeMarker;
  }
  return update;
}

/** Milissegundos de um Timestamp do Firestore; 0 se ainda não houver (gravação pendente). */
export function timestampMillis(value: unknown): number {
  const ts = value as { toMillis?: () => number } | null | undefined;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : 0;
}

/** Versão da foto (muda a cada troca), usada para renovar o cache da imagem. */
export const photoVersion = timestampMillis;

/** Ordena os vínculos do mais antigo ao mais novo; os ainda sem horário (recém-criados) vão ao fim. */
export function sortMembersByAddedAt<T extends { addedAt?: unknown }>(members: readonly T[]): T[] {
  const key = (m: T) => timestampMillis(m.addedAt) || Number.MAX_SAFE_INTEGER;
  return [...members].sort((a, b) => key(a) - key(b));
}

/** Idade para exibição: separa anos e meses. */
export function splitAge(totalMonths: number): { years: number; months: number } {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}
