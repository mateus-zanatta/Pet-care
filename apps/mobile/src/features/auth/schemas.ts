import { unmetPasswordRules } from '@petcare/shared';
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

/**
 * Senha FORTE (regras em @petcare/shared > security.ts): 10+ caracteres, maiúscula, minúscula, número e símbolo,
 * sem 3 caracteres iguais seguidos, sem o nome/e-mail da pessoa e sem senhas batidas. A lista do que falta aparece
 * ao vivo embaixo do campo (PasswordStrength).
 */
export const registerSchema = z
  .object({
    name: z.string().trim().min(1, { message: 'validation.required' }).max(80, { message: 'validation.tooLong' }),
    email,
    password: z.string().min(1, { message: 'validation.required' }),
    acceptTerms: z.boolean().refine((v) => v === true, { message: 'validation.termsRequired' }),
  })
  .superRefine((values, ctx) => {
    if (!values.password) return;
    if (unmetPasswordRules(values.password, { email: values.email, name: values.name }).length > 0) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'validation.passwordWeak' });
    }
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;
