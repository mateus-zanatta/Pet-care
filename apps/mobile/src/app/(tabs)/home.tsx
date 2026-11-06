import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { type IconName } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { EnterView } from '@/components/motion/EnterView';
import { HubCard } from '@/components/ui/HubCard';
import { NearestVetCard } from '@/features/nearby/NearestVetCard';

type Shortcut = { key: 'pets' | 'adoption' | 'rescue' | 'report'; icon: IconName; href: Href };

const SHORTCUTS: Shortcut[] = [
  { key: 'pets', icon: 'paw', href: '/pets' },
  { key: 'adoption', icon: 'heart', href: '/adoption' },
  { key: 'rescue', icon: 'medkit', href: '/rescue' },
  { key: 'report', icon: 'shield-checkmark', href: '/report' },
];

export default function HomeScreen() {
  const { t } = useTranslation('home');
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.displayName?.trim().split(/\s+/)[0];

  return (
    <Screen edges={['top', 'left', 'right']}>
      <EnterView index={0} style={{ gap: 4 }}>
        <AppText variant="display">
          {firstName ? t('greetingNamed', { name: firstName }) : t('greeting')}
        </AppText>
        <AppText color="textMuted">{t('question')}</AppText>
      </EnterView>

      {SHORTCUTS.map(({ key, icon, href }, index) => (
        <HubCard
          key={key}
          index={index + 1}
          tone={key === 'pets' ? 'primary' : key === 'adoption' ? 'accent' : 'surface'}
          icon={icon}
          title={t(`shortcuts.${key}.title`)}
          body={t(`shortcuts.${key}.subtitle`)}
          onPress={() => router.push(href)}
          testID={`shortcut-${key}`}
        />
      ))}

      <NearestVetCard />
    </Screen>
  );
}
