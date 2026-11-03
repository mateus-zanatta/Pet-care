/**
 * Formato do RGA visto no SinPatinhas: `XXX.XXXX.X-UF` (ex.: ABC.1D23.C-SP).
 * Só um arquivo real foi analisado; por isso o formato é um AVISO, nunca um bloqueio.
 */
export const RGA_REGEX = /^[A-Z0-9]{3}\.[A-Z0-9]{4}\.[A-Z0-9]-[A-Z]{2}$/;

export function normalizeRga(value: string): string {
  return value.trim().toUpperCase();
}

export function isRgaFormatValid(value: string): boolean {
  return RGA_REGEX.test(normalizeRga(value));
}

/** URL oficial de validação (o QR da carteira traz o mesmo endereço, sem "https://"). */
export function buildSinpatinhasValidationUrl(rga: string): string {
  return `https://sinpatinhas.mma.gov.br/validacao-qr-code?nuRGA=${encodeURIComponent(
    normalizeRga(rga),
  )}&tipo=RG_PET`;
}
