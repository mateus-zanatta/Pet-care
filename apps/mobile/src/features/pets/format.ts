import { type Pet, computePetAgeMonths } from '@petcare/shared';
import type { TFunction } from 'i18next';
import { splitAge } from './pets.mapper';

type PetsT = TFunction<'pets'>;

/** "2 anos e 6 m" / "5 meses" (idade aproximada recebe o prefixo "aprox."). */
export function formatAge(pet: Pick<Pet, 'birthDate' | 'approxAge'>, t: PetsT, today?: string): string | null {
  const months = computePetAgeMonths(pet, today);
  if (months === null) return null;
  const { years, months: rest } = splitAge(months);
  const text =
    years > 0
      ? t('detail.ageYearsMonths', { count: years, years, months: rest })
      : t('detail.ageMonthsOnly', { count: rest });
  return pet.birthDate ? text : `${t('detail.approx')} ${text}`;
}

/** Resumo de uma linha: "Gato · Fêmea · 2 anos e 6 m". */
export function petSummary(pet: Pet, t: PetsT): string {
  return [t(`species.${pet.species}`), pet.sex === 'unknown' ? null : t(`sex.${pet.sex}`), formatAge(pet, t)]
    .filter(Boolean)
    .join(' · ');
}
