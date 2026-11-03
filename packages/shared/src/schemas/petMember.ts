import { z } from 'zod';
import { MEMBER_ROLE } from '../enums';

/** ID determinístico: permite que as regras de segurança usem `exists()` direto, sem busca. */
export function petMemberId(petId: string, uid: string): string {
  return `${petId}_${uid}`;
}

/** `pet_members/{petId}_{uid}` */
export const petMemberSchema = z.object({
  petId: z.string().min(1),
  uid: z.string().min(1),
  role: z.enum(MEMBER_ROLE),
  displayName: z.string().max(80).optional(),
  addedAt: z.unknown().optional(),
});
export type PetMember = z.infer<typeof petMemberSchema>;
