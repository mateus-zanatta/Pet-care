import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { useUser } from '@/features/auth/AuthProvider';
import { PetListItem } from '@/features/pets/PetListItem';
import { useMemberships } from '@/features/pets/hooks';
import { sortMembersByAddedAt } from '@/features/pets/pets.mapper';

export default function PetsScreen() {
  const { t } = useTranslation('pets');
  const { t: te } = useTranslation('errors');
  const router = useRouter();
  const user = useUser();
  const memberships = useMemberships(user.uid);

  const members = useMemo(() => sortMembersByAddedAt(memberships.data), [memberships.data]);

  if (user.isAnonymous) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <EmptyState
          icon="person-circle"
          title={t('needAccount.title')}
          body={t('needAccount.body')}
          actionLabel={t('needAccount.cta')}
          onAction={() => router.push('/register')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top', 'left', 'right']}
      footer={members.length > 0 ? <Button label={t('add')} icon="add" onPress={() => router.push('/pet/new')} /> : undefined}
    >
      <AppText variant="display">{t('title')}</AppText>
      {memberships.loading ? <LoadingView /> : null}
      {memberships.failed ? <Banner tone="error">{te('pets.loadFailed')}</Banner> : null}
      {!memberships.loading && !memberships.failed && members.length === 0 ? (
        <EmptyState
          icon="paw"
          title={t('empty.title')}
          body={t('empty.body')}
          actionLabel={t('empty.cta')}
          onAction={() => router.push('/pet/new')}
        />
      ) : null}
      <View style={{ gap: 12 }}>
        {members.map((member) => (
          <PetListItem key={member.petId} petId={member.petId} role={member.role} />
        ))}
      </View>
    </Screen>
  );
}
