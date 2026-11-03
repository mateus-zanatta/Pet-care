import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';

type Shortcut = { key: 'pets' | 'rescue' | 'report'; icon: IconName; href: Href };

const SHORTCUTS: Shortcut[] = [
  { key: 'pets', icon: 'paw', href: '/pets' },
  { key: 'rescue', icon: 'heart', href: '/rescue' },
  { key: 'report', icon: 'shield-checkmark', href: '/report' },
];

export default function HomeScreen() {
  const { t } = useTranslation('home');
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={{ gap: 4 }}>
        <AppText variant="display">
          {firstName ? t('greetingNamed', { name: firstName }) : t('greeting')}
        </AppText>
        <AppText color="textMuted">{t('question')}</AppText>
      </View>

      {SHORTCUTS.map(({ key, icon, href }) => (
        <Card
          key={key}
          tone={key === 'pets' ? 'primary' : 'surface'}
          onPress={() => router.push(href)}
          accessibilityLabel={`${t(`shortcuts.${key}.title`)}. ${t(`shortcuts.${key}.subtitle`)}`}
          testID={`shortcut-${key}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64 }}>
            <Icon name={icon} size={40} color={key === 'pets' ? 'onPrimaryContainer' : 'primary'} />
            <View style={{ flex: 1 }}>
              <AppText variant="title" color={key === 'pets' ? 'onPrimaryContainer' : 'text'}>
                {t(`shortcuts.${key}.title`)}
              </AppText>
              <AppText color={key === 'pets' ? 'onPrimaryContainer' : 'textMuted'}>
                {t(`shortcuts.${key}.subtitle`)}
              </AppText>
            </View>
            <Icon name="chevron-forward" color={key === 'pets' ? 'onPrimaryContainer' : 'textMuted'} />
          </View>
        </Card>
      ))}

      <Card tone="alt">
        <View style={{ gap: 6 }} accessible accessibilityLabel={`${t('nearest.title')}. ${t('nearest.soon')}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="medkit" color="primary" />
            <AppText variant="heading">{t('nearest.title')}</AppText>
          </View>
          <AppText color="textMuted">{t('nearest.soon')}</AppText>
        </View>
      </Card>
    </Screen>
  );
}
