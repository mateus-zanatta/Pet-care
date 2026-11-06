import type { LatLng } from '@petcare/shared';
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useItemEnter } from '@/components/motion/motion';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import {
  LocationError,
  geocodeAddress,
  getCurrentPosition,
  requestLocationPermission,
} from '@/features/nearby/location';

type Props = {
  value: LatLng | null;
  onChange: (point: LatLng | null) => void;
  /** Texto explicando para que serve o local (e quem vê). */
  help: string;
  error?: string;
};

/**
 * Local de um registro: "Usar minha localização" (pede a permissão só aqui, na hora) ou endereço digitado,
 * convertido em coordenadas pelo próprio celular (grátis, sem chave). A permissão nunca é obrigatória.
 */
export function LocationPicker({ value, onChange, help, error }: Props) {
  const { t } = useTranslation('centrals');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState<'gps' | 'address' | null>(null);
  const [problem, setProblem] = useState<string>();
  const itemEnter = useItemEnter();

  const run = async (kind: 'gps' | 'address') => {
    setBusy(kind);
    setProblem(undefined);
    try {
      if (kind === 'gps') {
        const permission = await requestLocationPermission();
        if (permission !== 'granted') {
          setProblem(t('location.errors.denied'));
          return;
        }
        onChange(await getCurrentPosition());
      } else {
        onChange(await geocodeAddress(address));
      }
    } catch (e) {
      const code = e instanceof LocationError ? e.code : 'unavailable';
      setProblem(t(`location.errors.${code}`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">{t('location.label')}</AppText>
      <AppText variant="caption" color="textMuted">
        {help}
      </AppText>
      {value ? (
        <Animated.View entering={itemEnter}>
          <Card tone="primary">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="location" color="onPrimaryContainer" />
              <AppText color="onPrimaryContainer" style={{ flex: 1 }} testID="location-set">
                {t('location.set', { lat: value.lat.toFixed(4), lng: value.lng.toFixed(4) })}
              </AppText>
            </View>
          </Card>
        </Animated.View>
      ) : null}
      <Button variant="secondary" icon="navigate" label={t('location.useGps')} loading={busy === 'gps'} disabled={busy !== null} onPress={() => void run('gps')} />
      <TextField label={t('location.address')} value={address} onChangeText={setAddress} placeholder={t('location.addressPlaceholder')} />
      <Button
        variant="ghost"
        icon="search"
        label={t('location.findAddress')}
        loading={busy === 'address'}
        disabled={busy !== null || address.trim().length < 5}
        onPress={() => void run('address')}
      />
      {problem || error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {problem ?? error}
        </AppText>
      ) : null}
    </View>
  );
}

