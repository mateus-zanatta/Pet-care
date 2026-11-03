import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme/ThemeProvider';

/** Foto redonda do pet; sem foto, mostra uma patinha. A imagem é decorativa (o nome vem ao lado). */
export function PetPhoto({ url, size = 64 }: { url: string | null; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: colors.primaryContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Icon name="paw" size={size * 0.5} color="onPrimaryContainer" />
      )}
    </View>
  );
}
