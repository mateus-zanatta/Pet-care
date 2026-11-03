import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingView } from '@/components/ui/states';
import { usePet } from '@/features/pets/hooks';
import { RgaImportFlow } from '@/features/rga/RgaImportFlow';

export default function UpdatePetFromRgaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('pets');
  const { data: pet, loading } = usePet(id);

  if (loading) return <LoadingView />;
  if (!pet) {
    return (
      <Screen>
        <EmptyState icon="alert-circle" title={t('notFound')} body="" />
      </Screen>
    );
  }
  return <RgaImportFlow existingPet={pet} />;
}
