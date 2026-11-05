import type { LatLng } from '@petcare/shared';

export type MapsApp = 'google' | 'waze' | 'apple';

/**
 * Links de "Como chegar". São links https: abrem o app (se instalado) ou o site, sem precisar de chave.
 * O Apple Maps só é oferecido no iPhone.
 */
export function directionsLinks(to: LatLng, platform: 'ios' | 'android' | string): { app: MapsApp; url: string }[] {
  const dest = `${to.lat},${to.lng}`;
  const links: { app: MapsApp; url: string }[] = [
    { app: 'google', url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}` },
    { app: 'waze', url: `https://waze.com/ul?ll=${encodeURIComponent(dest)}&navigate=yes` },
  ];
  if (platform === 'ios') links.push({ app: 'apple', url: `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}` });
  return links;
}

/** "+55 (11) 3333-4444" -> "tel:+551133334444". Null se não parecer um telefone. */
export function phoneUrl(phone: string | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return /^\+?\d{8,15}$/.test(cleaned) ? `tel:${cleaned}` : null;
}

/** "350 m" / "1,2 km" / "12 km". */
export function formatDistance(km: number, locale: 'pt-BR' | 'en'): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  const value = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${locale === 'pt-BR' ? value.replace('.', ',') : value} km`;
}
