import { z } from 'zod';
import { BR_UF } from '../enums';
import { isBrUf } from './pet';

/** Veterinário que atendeu/prescreveu: nome e CRMV (número + UF). Tudo opcional. */
export const vetSchema = z.object({
  name: z.string().max(80).optional(),
  crmvNumber: z.string().regex(/^\d{1,8}$/).optional(),
  crmvUf: z.enum(BR_UF).optional(),
});
export type Vet = z.infer<typeof vetSchema>;

export type VetFormValues = { vetName: string; crmvNumber: string; crmvUf: string };

type Issue = (path: string, message: string) => void;

export function validateVetFields(v: VetFormValues, issue: Issue): void {
  if (v.crmvNumber !== '' && !/^\d{1,8}$/.test(v.crmvNumber)) issue('crmvNumber', 'validation.crmvInvalid');
  if (v.crmvUf !== '' && !isBrUf(v.crmvUf.toUpperCase())) issue('crmvUf', 'validation.ufInvalid');
  if (v.crmvNumber !== '' && v.crmvUf === '') issue('crmvUf', 'validation.required');
}

export function vetFromForm(v: VetFormValues): Vet | undefined {
  const name = v.vetName.trim();
  const number = v.crmvNumber.trim();
  const uf = v.crmvUf.trim().toUpperCase();
  if (!name && !number) return undefined;
  const vet: Vet = {};
  if (name) vet.name = name;
  if (number) vet.crmvNumber = number;
  if (number && isBrUf(uf)) vet.crmvUf = uf;
  return vet;
}

export function vetToForm(vet: Vet | undefined): VetFormValues {
  return { vetName: vet?.name ?? '', crmvNumber: vet?.crmvNumber ?? '', crmvUf: vet?.crmvUf ?? '' };
}
