import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Screen } from '@/components/ui/Screen';

type Section = { title: string; body: string };

/** Mostra os Termos ou a Política de Privacidade a partir das traduções (namespace "legal"). */
export function LegalDocument({ doc }: { doc: 'terms' | 'privacy' }) {
  const { t } = useTranslation('legal');
  const sections = t(`${doc}.sections`, { returnObjects: true }) as unknown as Section[];

  return (
    <Screen>
      <Banner tone="warning">{t('draftNotice')}</Banner>
      <AppText variant="display">{t(`${doc}.title`)}</AppText>
      <AppText variant="caption" color="textMuted">
        {t('updatedAt')}
      </AppText>
      {sections.map((section) => (
        <View key={section.title} style={{ gap: 6 }}>
          <AppText variant="heading">{section.title}</AppText>
          <AppText>{section.body}</AppText>
        </View>
      ))}
    </Screen>
  );
}
