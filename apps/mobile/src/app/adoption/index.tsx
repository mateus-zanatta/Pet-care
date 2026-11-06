import { ADOPTION_SPECIES, type AdoptionListing, type AdoptionSpecies } from '@petcare/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ChoiceChips } from '@/components/ui/ChoiceChips';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { useAuth } from '@/features/auth/AuthProvider';
import { AdoptionCard } from '@/features/adoption/AdoptionCard';
import { subscribeAdoptions, subscribeMyAdoptions } from '@/features/centrals/centrals.repo';
import { AccountRequired, EnterView } from '@/features/centrals/components';
import { useLive } from '@/features/centrals/hooks';

type Filter = 'all' | AdoptionSpecies;

export default function AdoptionScreen() {
  const { t } = useTranslation('adoption');
  const router = useRouter();
  const { user } = useAuth();
  const registered = Boolean(user && !user.isAnonymous);
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [filter, setFilter] = useState<Filter>('all');

  const browse = useLive<AdoptionListing[]>('browse', [], subscribeAdoptions, 'adoption.list');
  const mine = useLive<AdoptionListing[]>(registered && tab === 'mine' ? `mine-${user?.uid}` : null, [], (ok, ko) => subscribeMyAdoptions(user!.uid, ok, ko), 'adoption.mine');
  const source = tab === 'mine' ? mine : browse;
  const items = source.data.filter((l) => filter === 'all' || l.species === filter);

  return (
    <Screen>
      <EnterView index={0} style={{ gap: 8 }}>
        <AppText variant="display">{t('title')}</AppText>
        <AppText color="textMuted">{t('intro')}</AppText>
      </EnterView>

      {registered ? (
        <EnterView index={1}>
          <Button variant="accent" icon="add-circle" label={t('cta')} onPress={() => router.push('/adoption/new')} testID="adoption-new" />
        </EnterView>
      ) : (
        <AccountRequired body={t('accountBody')} />
      )}

      <Banner tone="info">{t('responsible')}</Banner>

      {registered ? (
        <ChoiceChips
          label={t('show')}
          options={[
            { value: 'browse', label: t('tabs.browse') },
            { value: 'mine', label: t('tabs.mine') },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
      <ChoiceChips
        label={t('filter')}
        options={[{ value: 'all', label: t('all') }, ...ADOPTION_SPECIES.map((value) => ({ value, label: t(`species.${value}`) }))]}
        value={filter}
        onChange={setFilter}
      />

      {source.loading ? <LoadingView /> : null}
      {source.error ? <Banner tone="error">{t('loadError')}</Banner> : null}
      {!source.loading && !source.error && items.length === 0 ? (
        <EmptyState icon="heart" title={tab === 'mine' ? t('emptyMine.title') : t('empty.title')} body={tab === 'mine' ? t('emptyMine.body') : t('empty.body')} />
      ) : null}
      <View style={{ gap: 12 }}>
        {items.map((listing, index) => (
          <AdoptionCard key={listing.id} listing={listing} index={index} onPress={() => router.push({ pathname: '/adoption/[id]', params: { id: listing.id } })} />
        ))}
      </View>
    </Screen>
  );
}
