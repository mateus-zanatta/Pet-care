/** Cores mais comuns (guardamos a chave; o app mostra no idioma da pessoa). Texto livre também é aceito. */
export const COLOR_KEYS = ['black', 'white', 'brown', 'caramel', 'gray', 'golden', 'brindle', 'spotted', 'tricolor', 'other'] as const;

/** "caramel" -> "Caramelo"; texto livre aparece como foi digitado. */
export function colorLabel(value: string, t: (key: never) => string, exists: (key: string) => boolean): string {
  const key = `adoption:colors.${value}`;
  return exists(key) ? t(key as never) : value;
}

/** Link de WhatsApp a partir do telefone (números do Brasil sem DDI ganham o 55). */
export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}`;
}
