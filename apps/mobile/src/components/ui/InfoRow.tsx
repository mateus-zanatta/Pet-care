import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';

/** Linha "rótulo: valor" para telas de detalhe (lida como um bloco só pelo leitor de tela). */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2 }}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}
