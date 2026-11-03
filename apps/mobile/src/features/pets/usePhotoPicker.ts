import * as ImagePicker from 'expo-image-picker';
import type { PickedPhoto } from './pets.repo';

export class PermissionDeniedError extends Error {
  constructor(public readonly kind: 'camera') {
    super(`permission-denied:${kind}`);
  }
}

function toPhoto(result: ImagePicker.ImagePickerResult): PickedPhoto | null {
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

const profileOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
  exif: false,
};

/** Documentos (receitas, exames): a foto inteira, sem recorte. */
const documentOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.9,
  exif: false,
};

type PickOptions = { /** false = foto inteira, sem recorte quadrado (documentos). */ crop?: boolean };

const optionsFor = ({ crop = true }: PickOptions) => (crop ? profileOptions : documentOptions);

/** Galeria: o seletor do sistema não exige permissão de acesso às fotos. */
export async function pickFromGallery(options: PickOptions = {}): Promise<PickedPhoto | null> {
  return toPhoto(await ImagePicker.launchImageLibraryAsync(optionsFor(options)));
}

/** Câmera: a permissão só é pedida aqui, na hora de usar. */
export async function takePhoto(options: PickOptions = {}): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDeniedError('camera');
  return toPhoto(await ImagePicker.launchCameraAsync(optionsFor(options)));
}
