import { z } from 'zod';
import { LOCALES } from '../enums';

export const userConsentSchema = z.object({
  termsVersion: z.string(),
  privacyVersion: z.string(),
  acceptedAt: z.unknown(),
});

/** `users/{uid}` — visível apenas ao próprio usuário. */
export const userDocSchema = z.object({
  displayName: z.string().max(80).optional(),
  locale: z.enum(LOCALES),
  isAnonymous: z.boolean(),
  consents: userConsentSchema.optional(),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
});
export type UserDoc = z.infer<typeof userDocSchema>;
