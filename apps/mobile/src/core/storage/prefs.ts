import AsyncStorage from '@react-native-async-storage/async-storage';

/** Preferências locais do aparelho (não sensíveis). Falhas de leitura/escrita são toleradas. */
type PrefKey = 'language' | 'theme';

const KEY_PREFIX = 'petcare.pref.';

export async function getPref(key: PrefKey): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

export async function setPref(key: PrefKey, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + key, value);
  } catch {
    // preferência não essencial
  }
}
