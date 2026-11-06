import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '@/components/ui/Icon';

/**
 * Guia do resgate em 4 etapas (textos em locales/<idioma>/rescue.json > guide). O app GUIA e organiza;
 * nunca indica remédio, dose ou diagnóstico: tudo de saúde é "com o veterinário".
 */
export const GUIDE_STEPS: readonly { id: 'approach' | 'vet' | 'quarantine' | 'aftercare'; icon: IconName; items: readonly string[] }[] = [
  { id: 'approach', icon: 'eye', items: ['safety', 'assess', 'calm', 'food', 'contain', 'transport'] },
  { id: 'vet', icon: 'medkit', items: ['emergency', 'wounds', 'deworm', 'vaccines', 'neuter', 'records'] },
  { id: 'quarantine', icon: 'shield-checkmark', items: ['separate', 'days', 'observe', 'hygiene', 'ownItems'] },
  { id: 'aftercare', icon: 'home', items: ['shelter', 'food', 'affection', 'adoption', 'followUp'] },
];

export type GuideProgress = { step: number; done: string[] };

const KEY = 'rescue-guide-v1';
export const EMPTY_PROGRESS: GuideProgress = { step: 0, done: [] };

/** Progresso guardado só no aparelho (quem está resgatando pode fechar o app e voltar depois). */
export async function loadGuideProgress(): Promise<GuideProgress> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<GuideProgress>) : null;
    const step = typeof parsed?.step === 'number' ? Math.min(Math.max(parsed.step, 0), GUIDE_STEPS.length - 1) : 0;
    return { step, done: Array.isArray(parsed?.done) ? parsed.done.filter((d): d is string => typeof d === 'string') : [] };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export async function saveGuideProgress(progress: GuideProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // sem armazenamento: o guia funciona mesmo assim, só não lembra
  }
}

export const itemKey = (stepId: string, item: string) => `${stepId}.${item}`;

/** Fração concluída (0–1) de todos os itens do guia. */
export function guideCompletion(done: readonly string[]): number {
  const total = GUIDE_STEPS.reduce((n, s) => n + s.items.length, 0);
  const valid = new Set(GUIDE_STEPS.flatMap((s) => s.items.map((i) => itemKey(s.id, i))));
  return done.filter((d) => valid.has(d)).length / total;
}
