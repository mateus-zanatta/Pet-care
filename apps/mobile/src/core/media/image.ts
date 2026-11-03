import * as ImageManipulator from 'expo-image-manipulator';

const MAX_SIDE = 1280;

/**
 * Prepara uma foto para envio: reduz o tamanho e RECODIFICA como JPEG. Esse processo
 * descarta os metadados EXIF originais (inclusive a localização GPS), como exige a
 * política de privacidade antes de qualquer foto ser compartilhada com outras pessoas.
 */
export async function prepareImageForUpload(uri: string, width?: number, height?: number) {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  const longSide = Math.max(width ?? 0, height ?? 0);
  if (longSide > MAX_SIDE) {
    context.resize(
      (width ?? 0) >= (height ?? 0) ? { width: MAX_SIDE } : { height: MAX_SIDE },
    );
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
}
