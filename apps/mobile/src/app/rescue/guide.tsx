import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInLeft, FadeInRight, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { DURATION, EASE_OUT } from '@/components/motion/motion';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { LoadingView } from '@/components/ui/states';
import { track } from '@/core/analytics';
import { ProgressBar } from '@/features/rescue/ProgressBar';
import { EMPTY_PROGRESS, GUIDE_STEPS, type GuideProgress, guideCompletion, itemKey, loadGuideProgress, saveGuideProgress } from '@/features/rescue/guide';

/** Guia do resgate: 4 etapas com checklist; o progresso fica salvo no aparelho. */
export default function RescueGuideScreen() {
  const { t } = useTranslation('rescue');
  const router = useRouter();
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState<GuideProgress | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    void loadGuideProgress().then(setProgress);
  }, []);

  const update = (next: GuideProgress) => {
    setProgress(next);
    void saveGuideProgress(next);
  };

  // Etapa nova entra do lado para onde a pessoa "andou" (frente = da direita; voltar = da esquerda).
  const entering = useMemo(() => {
    if (reduced) return FadeIn.duration(DURATION.state);
    return (direction === 1 ? FadeInRight : FadeInLeft).duration(DURATION.enter).easing(EASE_OUT);
  }, [direction, reduced]);

  if (!progress) return <LoadingView />;
  const step = GUIDE_STEPS[progress.step]!;
  const last = progress.step === GUIDE_STEPS.length - 1;
  const completion = guideCompletion(progress.done);

  const goTo = (index: number) => {
    setDirection(index > progress.step ? 1 : -1);
    update({ ...progress, step: index });
    track({ name: 'rescue_guide_step', step: index + 1 });
  };

  const toggle = (item: string) => {
    const key = itemKey(step.id, item);
    update({ ...progress, done: progress.done.includes(key) ? progress.done.filter((d) => d !== key) : [...progress.done, key] });
  };

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <AppText variant="label" color="textMuted">
          {t('guide.stepOf', { current: progress.step + 1, total: GUIDE_STEPS.length })}
        </AppText>
        <ProgressBar value={completion} label={t('guide.progress', { percent: Math.round(completion * 100) })} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {GUIDE_STEPS.map((s, i) => (
          <View key={s.id} style={{ flex: 1 }}>
            <Button
              variant={i === progress.step ? 'primary' : 'ghost'}
              label={String(i + 1)}
              accessibilityHint={t(`guide.steps.${s.id}.title`)}
              onPress={() => goTo(i)}
              testID={`guide-step-${i + 1}`}
            />
          </View>
        ))}
      </View>

      <Animated.View key={step.id} entering={entering} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name={step.icon} size={40} color="primary" />
          <AppText variant="title" style={{ flex: 1 }}>
            {t(`guide.steps.${step.id}.title`)}
          </AppText>
        </View>
        <AppText color="textMuted">{t(`guide.steps.${step.id}.summary`)}</AppText>
        {step.id === 'approach' ? <Banner tone="warning">{t('guide.wildWarning')}</Banner> : null}
        {step.id === 'vet' ? <Banner tone="info">{t('guide.vetOnly')}</Banner> : null}

        <Card>
          <View style={{ gap: 14 }}>
            {step.items.map((item) => {
              const checked = progress.done.includes(itemKey(step.id, item));
              return (
                <Checkbox key={item} checked={checked} onChange={() => toggle(item)} accessibilityLabel={t(`guide.steps.${step.id}.items.${item}.title` as never)}>
                  <View style={{ gap: 2 }}>
                    <AppText variant="label" style={checked ? { textDecorationLine: 'line-through' } : undefined}>
                      {t(`guide.steps.${step.id}.items.${item}.title` as never)}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {t(`guide.steps.${step.id}.items.${item}.body` as never)}
                    </AppText>
                  </View>
                </Checkbox>
              );
            })}
          </View>
        </Card>

        {step.id === 'vet' ? (
          <Button variant="secondary" icon="medkit" label={t('guide.findVet')} onPress={() => router.push({ pathname: '/nearby', params: { mode: 'emergency' } })} />
        ) : null}
        {last ? (
          <Card tone="accent">
            <View style={{ gap: 12 }}>
              <AppText variant="heading" color="onAccentContainer">
                {t('guide.finishTitle')}
              </AppText>
              <AppText color="onAccentContainer">{t('guide.finishBody')}</AppText>
              <Button variant="accent" icon="heart" label={t('guide.toAdoption')} onPress={() => router.push('/adoption/new')} />
              <Button variant="secondary" icon="paw" label={t('guide.toPet')} onPress={() => router.push('/pet/new')} />
            </View>
          </Card>
        ) : null}
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {progress.step > 0 ? (
          <View style={{ flex: 1 }}>
            <Button variant="secondary" icon="arrow-back" label={t('guide.previous')} onPress={() => goTo(progress.step - 1)} />
          </View>
        ) : null}
        {!last ? (
          <View style={{ flex: 1 }}>
            <Button icon="arrow-forward" label={t('guide.next')} onPress={() => goTo(progress.step + 1)} testID="guide-next" />
          </View>
        ) : null}
      </View>
      <Button variant="ghost" label={t('guide.restart')} onPress={() => update(EMPTY_PROGRESS)} />
    </Screen>
  );
}
