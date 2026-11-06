import type { RescueAnimalKind } from '@petcare/shared';
import { rescueAuthority } from '@petcare/shared';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { CallButton } from '@/features/centrals/components';

/** Números oficiais (nacionais). Não dependem de internet nem de conta. */
export const OFFICIAL_NUMBERS = { police: '190', firefighters: '193', ibama: '08000618080', disqueDenuncia: '181' } as const;

/**
 * Contatos para chamar conforme o animal: silvestre/marinho -> órgão ambiental (IBAMA, Polícia Ambiental pelo 190);
 * cavalo/gado -> Bombeiros/Polícia (risco na via) e prefeitura; doméstico -> ONGs, CCZ e emergência veterinária.
 */
export function OfficialContacts({ kind }: { kind?: RescueAnimalKind }) {
  const { t } = useTranslation('rescue');
  const authority = kind ? rescueAuthority(kind) : null;
  return (
    <Card tone="alt">
      <View style={{ gap: 10 }}>
        <AppText variant="heading">{t('contacts.title')}</AppText>
        {authority ? <AppText>{t(`contacts.advice.${authority}`)}</AppText> : <AppText color="textMuted">{t('contacts.intro')}</AppText>}
        <CallButton label={t('contacts.ibama')} phone={OFFICIAL_NUMBERS.ibama} variant={authority === 'environmental' ? 'primary' : 'secondary'} />
        <CallButton label={t('contacts.police')} phone={OFFICIAL_NUMBERS.police} />
        <CallButton label={t('contacts.firefighters')} phone={OFFICIAL_NUMBERS.firefighters} />
        <AppText variant="caption" color="textMuted">
          {t('contacts.ccz')}
        </AppText>
      </View>
    </Card>
  );
}
