import { PLACE_CATEGORY, type PlaceCategory, type PlaceSuggestionForm } from '@petcare/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { SuggestPlaceForm } from '@/features/nearby/SuggestPlaceForm';

type Params = { kind?: string; placeId?: string; name?: string; category?: string; address?: string; phone?: string };

/** "Sugerir um local" (novo) ou "Corrigir dados" (vem do cartão do local, já preenchido). */
export default function SuggestPlaceScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const { user } = useAuth();

  const initial = useMemo<PlaceSuggestionForm>(() => {
    const category = (PLACE_CATEGORY as readonly string[]).includes(params.category ?? '') ? (params.category as PlaceCategory) : 'vet';
    const fix = params.kind === 'fix' && Boolean(params.placeId);
    return {
      kind: fix ? 'fix' : 'new',
      placeId: fix ? (params.placeId ?? '') : '',
      name: params.name ?? '',
      category,
      address: params.address ?? '',
      phone: params.phone ?? '',
      is24h: false,
      note: '',
    };
  }, [params.kind, params.placeId, params.name, params.category, params.address, params.phone]);

  return <SuggestPlaceForm initial={initial} canSend={Boolean(user && !user.isAnonymous)} onDone={() => router.back()} />;
}
