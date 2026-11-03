/**
 * Carrega um módulo NATIVO com tolerância. Um build antigo do app (gerado antes de o módulo existir)
 * continua abrindo normalmente: o recurso que depende do módulo é que fica indisponível.
 * Use com `require` de texto fixo, para o Metro enxergar a dependência: `optionalModule(() => require('expo-camera'), 'expo-camera')`.
 */
export function optionalModule<T>(load: () => T, name: string): T | null {
  try {
    return load();
  } catch {
    if (__DEV__) console.warn(`[nativo] O módulo "${name}" não existe neste build do app. Gere um novo development build.`);
    return null;
  }
}
