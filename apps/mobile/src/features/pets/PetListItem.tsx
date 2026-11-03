import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { MemberRole } from '@petcare/shared';
import { PetPhoto } from './PetPhoto';
import { usePet, usePetPhotoUrl } from './hooks';
import { petSummary } from './format';

/** Cartão do pet na lista. Cada item acompanha o próprio pet em tempo real. */
export function PetListItem({ petId, role }: { petId: string; role: MemberRole }) {
  const { t } = useTranslation('pets');
  const router = useRouter();
  const { data: pet } = usePet(petId);
  const photoUrl = usePetPhotoUrl(pet);

  if (!pet) return null; // carregando, excluído ou sem acesso

  const summary = petSummary(pet, t);
  const shared = role !== 'owner';
  return (
    <Card
      onPress={() => router.push({ pathname: '/pet/[id]', params: { id: pet.id } })}
      accessibilityLabel={[pet.name, summary, shared ? t(`roles.${role}`) : ''].filter(Boolean).join('. ')}
      testID={`pet-${pet.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <PetPhoto url={photoUrl} size={64} />
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{pet.name}</AppText>
          <AppText color="textMuted">{summary}</AppText>
          {shared ? (
            <AppText variant="caption" color="primary">
              {t('sharedWithYou')} · {t(`roles.${role}`)}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevron-forward" color="textMuted" />
      </View>
    </Card>
  );
}
