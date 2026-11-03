import { z } from 'zod';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = z
  .string()
  .trim()
  .min(1, { message: 'validation.required' })
  .regex(EMAIL, { message: 'validation.emailInvalid' });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: 'validation.required' }),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, { message: 'validation.required' }).max(80, { message: 'validation.tooLong' }),
  email,
  password: z
    .string()
    .min(8, { message: 'validation.passwordTooShort' })
    .regex(/[A-Za-z]/, { message: 'validation.passwordWeak' })
    .regex(/\d/, { message: 'validation.passwordWeak' }),
  acceptTerms: z.boolean().refine((v) => v === true, { message: 'validation.termsRequired' }),
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;
