import React from 'react';
import { View } from 'react-native';
import { EnterView } from '@/components/motion/EnterView';
import type { ColorTokens } from '@/core/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';

/** Cartão grande de atalho (Home e centrais): ícone + título + descrição, com entrada em cascata e resposta ao toque. */
export function HubCard({
  icon,
  title,
  body,
  onPress,
  tone = 'surface',
  index = 0,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  onPress: () => void;
  tone?: 'surface' | 'primary' | 'accent';
  index?: number;
  testID?: string;
}) {
  const fg: keyof ColorTokens = tone === 'primary' ? 'onPrimaryContainer' : tone === 'accent' ? 'onAccentContainer' : 'text';
  const iconColor: keyof ColorTokens = tone === 'surface' ? 'primary' : fg;
  return (
    <EnterView index={index}>
      <Card tone={tone} onPress={onPress} accessibilityLabel={`${title}. ${body}`} testID={testID}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56 }}>
          <Icon name={icon} size={36} color={iconColor} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading" color={fg}>
              {title}
            </AppText>
            <AppText color={tone === 'surface' ? 'textMuted' : fg}>{body}</AppText>
          </View>
          <Icon name="chevron-forward" color={tone === 'surface' ? 'textMuted' : fg} />
        </View>
      </Card>
    </EnterView>
  );
}
