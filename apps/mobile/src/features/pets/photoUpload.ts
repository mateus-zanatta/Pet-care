import { diagnoseEmulatorConnection } from '@/core/firebase';
import { devLog } from '@/core/debug/devLog';
import { reportError } from '@/core/errors/report';
import { type PickedPhoto, uploadPetPhoto } from './pets.repo';

/**
 * - `uploaded`: a foto foi enviada e o pet aponta para ela.
 * - `deferred`: o servidor NÃO confirmou a gravação do pet (sem conexão), então a foto nem foi tentada.
 *   O pet existe só neste aparelho por enquanto; a pessoa precisa ser avisada (nada de falha silenciosa).
 * - `failed`: tentou enviar e deu erro.
 */
export type PhotoUploadOutcome = 'uploaded' | 'deferred' | 'failed';

/** Envia a foto de um pet recém-gravado, só se o servidor confirmou a gravação do pet. */
export async function uploadPhotoAfterSave(
  petId: string,
  photo: PickedPhoto,
  status: 'committed' | 'pending',
  scope: string,
): Promise<PhotoUploadOutcome> {
  if (status !== 'committed') {
    devLog('foto', 'NÃO enviada: o servidor não confirmou a gravação do pet (Firestore sem resposta em 10s).');
    diagnoseEmulatorConnection();
    return 'deferred';
  }
  try {
    devLog('foto', `enviando (${photo.base64 ? 'JPEG do RG' : 'arquivo local'})...`);
    await uploadPetPhoto(petId, photo);
    devLog('foto', 'enviada e vinculada ao pet.');
    return 'uploaded';
  } catch (error) {
    devLog('foto', `FALHOU: ${(error as { code?: string })?.code ?? 'erro sem código'}`);
    reportError(scope, error);
    return 'failed';
  }
}
