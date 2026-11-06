import { useMemo } from 'react';
import { Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion, cubicBezier, useReducedMotion } from 'react-native-reanimated';

/**
 * Linguagem de movimento do app (uma só, para tudo combinar):
 * - entrar/sair: ease-out forte; mover na tela: ease-in-out; nunca ease-in (atrasa o que a pessoa está olhando).
 * - toque: 120 ms; troca de estado pequena: 180 ms; entrada de conteúdo: 250 ms. Nada de UI passa de 300 ms.
 * - "Reduzir movimento" ligado no sistema: sem deslocamento nem escala, só esmaecer (que ainda explica a mudança).
 */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/**
 * Mesmas curvas no formato das transições de estilo (CSS) do Reanimated. ATENÇÃO: no celular o Reanimated só aceita
 * texto para curvas prontas ("ease-out"...); curva própria tem de ser `cubicBezier(...)`, nunca a string
 * "cubic-bezier(...)" (essa só funciona na web e derrubava o app). O teste motion.test.tsx confere com a validação nativa.
 */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const CSS_EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

export const DURATION = { press: 120, state: 180, enter: 250, exit: 200 } as const;
/** Intervalo entre itens que entram em cascata (30–80 ms; mais que isso parece lento). */
export const STAGGER_MS = 40;
/** Só os primeiros itens entram em cascata: o resto aparece junto, sem fazer ninguém esperar. */
const MAX_STAGGERED = 8;

/** Entrada de um bloco de conteúdo (de baixo, curta). Com "reduzir movimento": só esmaece. */
export function useEnterAnimation(index = 0) {
  const reduced = useReducedMotion();
  return useMemo(() => {
    const delay = Math.min(index, MAX_STAGGERED) * STAGGER_MS;
    if (reduced) return FadeIn.duration(DURATION.state).delay(delay).reduceMotion(ReduceMotion.Never);
    return FadeInDown.duration(DURATION.enter).delay(delay).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 12 }] });
  }, [index, reduced]);
}

const ITEM_ENTER = FadeInDown.duration(DURATION.enter).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 8 }] });
const ITEM_FADE = FadeIn.duration(DURATION.state).reduceMotion(ReduceMotion.Never);

/**
 * Item que aparece por ação da própria pessoa (ex.: "Adicionar vacina", local definido). Com "reduzir movimento":
 * só esmaece (menos e mais gentil, não zero: a mudança de estado continua explicada).
 */
export function useItemEnter() {
  return useReducedMotion() ? ITEM_FADE : ITEM_ENTER;
}

/** Saída: mais rápida que a entrada (a pessoa já decidiu). */
export const EXIT_FADE = FadeOut.duration(DURATION.exit).easing(EASE_OUT);
