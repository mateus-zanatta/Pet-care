import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, Linking, ScrollView, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '@/components/motion/PressableScale';
import { DURATION, EASE_IN_OUT, EXIT_FADE, useEnterAnimation, useItemEnter } from '@/components/motion/motion';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { dateOrderFor } from '@/core/dates';
import { useTheme } from '@/core/theme/ThemeProvider';
import { phoneUrl } from '@/features/nearby/directions';
import type { PickedPhoto } from '@/features/pets/pets.repo';
import { pickFromGallery, takePhoto, PermissionDeniedError } from '@/features/pets/usePhotoPicker';
import { usePhotoUrl } from './hooks';

/** Reflow suave quando itens entram/saem de uma lista (módulo: não recria a cada render). */
export const LIST_REFLOW = LinearTransition.duration(DURATION.state).easing(EASE_IN_OUT);

/* Blocos com entrada e cartão de atalho moram em components/ (sem depender do Firebase). */
export { EnterView } from '@/components/motion/EnterView';
export { HubCard } from '@/components/ui/HubCard';

/** Etiqueta de status (disponível, aberto, recebida...). */
export function StatusPill({ label, tone }: { label: string; tone: 'primary' | 'accent' | 'warning' | 'muted' | 'danger' }) {
  const { colors, radius } = useTheme();
  const map = {
    primary: [colors.primaryContainer, colors.onPrimaryContainer],
    accent: [colors.accentContainer, colors.onAccentContainer],
    warning: [colors.warningContainer, colors.onWarningContainer],
    danger: [colors.dangerContainer, colors.onDangerContainer],
    muted: [colors.surfaceAlt, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <AppText variant="caption" style={{ color: fg, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

/** Para quem está "sem cadastro": explica e leva ao cadastro (as centrais exigem conta). */
export function AccountRequired({ body }: { body: string }) {
  const { t } = useTranslation('centrals');
  const router = useRouter();
  return (
    <Card tone="alt">
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Icon name="person-circle" size={28} color="primary" />
          <AppText variant="heading" style={{ flex: 1 }}>
            {t('account.title')}
          </AppText>
        </View>
        <AppText color="textMuted">{body}</AppText>
        <Button label={t('account.cta')} icon="person-add" onPress={() => router.push('/register')} />
      </View>
    </Card>
  );
}

/** Números de emergência curtos (190, 193, 181...) também viram link de discagem. */
export function dialUrl(phone: string): string | null {
  return /^\d{3,4}$/.test(phone.trim()) ? `tel:${phone.trim()}` : phoneUrl(phone);
}

/** Botão de ligar para um número (abre o discador). */
export function CallButton({ label, phone, variant = 'secondary' }: { label: string; phone: string; variant?: 'primary' | 'secondary' | 'danger' | 'accent' }) {
  const url = dialUrl(phone);
  if (!url) return null;
  return <Button variant={variant} icon="call" label={label} onPress={() => void Linking.openURL(url)} />;
}

/* ---------------------------------- Fotos ---------------------------------- */

function Thumb({ uri, path, onRemove, removeLabel }: { uri?: string; path?: string; onRemove?: () => void; removeLabel: string }) {
  const { colors, radius } = useTheme();
  const remote = usePhotoUrl(path);
  const source = uri ?? remote;
  return (
    <Animated.View entering={useEnterAnimation(0)} exiting={EXIT_FADE} style={{ width: 96, height: 96 }}>
      <View style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
        {source ? <Image source={{ uri: source }} style={{ flex: 1 }} accessibilityIgnoresInvertColors /> : null}
      </View>
      {onRemove ? (
        <PressableScale
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          hitSlop={12}
          style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.overlay, borderRadius: 999, padding: 4 }}
        >
          <Icon name="close" size={16} color="onPrimary" />
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

/** Fotos de um registro: as já enviadas (`paths`) + as escolhidas agora (`picked`), até `max`. */
export function PhotoStrip({
  paths = [],
  picked,
  onPick,
  onRemovePath,
  onRemovePicked,
  max,
}: {
  paths?: string[];
  picked: PickedPhoto[];
  onPick: (photo: PickedPhoto) => void;
  onRemovePath?: (path: string) => void;
  onRemovePicked: (index: number) => void;
  max: number;
}) {
  const { t } = useTranslation('centrals');
  const full = paths.length + picked.length >= max;

  const add = async (source: 'camera' | 'gallery') => {
    try {
      const photo = source === 'camera' ? await takePhoto({ crop: false }) : await pickFromGallery({ crop: false });
      if (photo) onPick(photo);
    } catch (error) {
      if (error instanceof PermissionDeniedError) Alert.alert(t('photos.cameraDenied'));
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{t('photos.label', { count: paths.length + picked.length, max })}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {paths.map((p) => (
          <Thumb key={p} path={p} removeLabel={t('photos.remove')} onRemove={onRemovePath ? () => onRemovePath(p) : undefined} />
        ))}
        {picked.map((p, i) => (
          <Thumb key={p.uri} uri={p.uri} removeLabel={t('photos.remove')} onRemove={() => onRemovePicked(i)} />
        ))}
      </ScrollView>
      {!full ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" icon="camera" label={t('photos.camera')} onPress={() => void add('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" icon="images" label={t('photos.gallery')} onPress={() => void add('gallery')} />
          </View>
        </View>
      ) : null}
      <AppText variant="caption" color="textMuted">
        {t('photos.privacy')}
      </AppText>
    </View>
  );
}

/** Galeria horizontal só para ver (detalhe de um registro). */
export function PhotoGallery({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {paths.map((p) => (
        <GalleryImage key={p} path={p} />
      ))}
    </ScrollView>
  );
}

function GalleryImage({ path }: { path: string }) {
  const { colors, radius } = useTheme();
  const url = usePhotoUrl(path);
  return (
    <View style={{ width: 220, height: 180, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      {url ? <Image source={{ uri: url }} style={{ flex: 1 }} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
    </View>
  );
}

/* ------------------------- Lista de itens de saúde ------------------------- */

export type HealthItemValue = { name: string; date?: string; note?: string };

/** Editor de vacinas / remédios / exames já feitos (nome + data opcional + observação opcional). */
export function HealthListEditor({
  label,
  items,
  onChange,
  addLabel,
  namePlaceholder,
  error,
}: {
  label: string;
  items: HealthItemValue[];
  onChange: (items: HealthItemValue[]) => void;
  addLabel: string;
  namePlaceholder: string;
  error?: string;
}) {
  const { t, i18n } = useTranslation('centrals');
  const order = dateOrderFor(i18n.language === 'en' ? 'en' : 'pt-BR');
  const datePlaceholder = t('health.datePlaceholder');
  const itemEnter = useItemEnter();
  const set = (index: number, patch: Partial<HealthItemValue>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{label}</AppText>
      {items.map((item, index) => (
        <Animated.View key={index} entering={itemEnter} exiting={EXIT_FADE} layout={LIST_REFLOW}>
          <Card tone="alt">
            <View style={{ gap: 8 }}>
              <TextField label={t('health.name')} placeholder={namePlaceholder} value={item.name} onChangeText={(name) => set(index, { name })} />
              <DateField
                label={t('health.date')}
                order={order}
                placeholder={datePlaceholder}
                value={item.date ?? ''}
                onChange={(date) => set(index, { date: date || undefined })}
              />
              <TextField label={t('health.note')} value={item.note ?? ''} onChangeText={(note) => set(index, { note: note || undefined })} />
              <Button variant="ghost" icon="trash" label={t('health.remove')} onPress={() => onChange(items.filter((_, i) => i !== index))} />
            </View>
          </Card>
        </Animated.View>
      ))}
      {items.length < 20 ? <Button variant="secondary" icon="add" label={addLabel} onPress={() => onChange([...items, { name: '' }])} /> : null}
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
