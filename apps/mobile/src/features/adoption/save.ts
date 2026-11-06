import type { AdoptionInput } from '@petcare/shared';
import { createAdoption, updateAdoption, uploadCentralPhotos } from '@/features/centrals/centrals.repo';
import type { AdoptionPhotos } from './AdoptionForm';

/**
 * Salva o anúncio (novo ou editado) e depois as fotos. Se as fotos falharem, o anúncio já existe:
 * devolvemos `photosFailed` para avisar, em vez de perder tudo.
 */
export async function saveAdoption(input: AdoptionInput, photos: AdoptionPhotos, existingId?: string, previous: string[] = []) {
  const id = existingId ?? (await createAdoption(input)).id;
  if (existingId) await updateAdoption({ id, data: input });

  const changed = photos.picked.length > 0 || photos.keep.length !== previous.length;
  if (!changed) return { id, photosFailed: false };
  try {
    const paths = await uploadCentralPhotos('adoption', id, photos.keep, photos.picked);
    await updateAdoption({ id, photoPaths: paths });
    return { id, photosFailed: false };
  } catch {
    return { id, photosFailed: true };
  }
}
