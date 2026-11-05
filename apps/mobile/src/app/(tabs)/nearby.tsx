import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { NearbyScreen } from '@/features/nearby/NearbyScreen';

/** Aba "Perto de mim". `?mode=emergency` (vindo do Resgate) mostra emergência/24 h primeiro. */
export default function NearbyTab() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <NearbyScreen mode={mode === 'emergency' ? 'emergency' : undefined} />;
}
