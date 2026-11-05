import { z } from 'zod';
import { PLACE_CATEGORY, PLACE_SOURCE } from '../enums';

/** Raios de busca oferecidos (km). Valores fixos: melhor para o cache e evita buscas enormes. */
export const SEARCH_RADII_KM = [3, 5, 10, 20] as const;
export type SearchRadiusKm = (typeof SEARCH_RADII_KM)[number];
export const DEFAULT_RADIUS_KM: SearchRadiusKm = 5;
export const MAX_PLACES = 150;

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

/** Local devolvido pela busca (dados públicos de estabelecimentos). */
export const placeSchema = z.object({
  /** "osm:node/123", "osm:way/456"... */
  id: z.string().min(1).max(120),
  source: z.enum(PLACE_SOURCE),
  /** Muitos locais do OSM não têm nome cadastrado: o app mostra o tipo ("Clínica veterinária") no lugar. */
  name: z.string().min(1).max(120).optional(),
  category: z.enum(PLACE_CATEGORY),
  lat,
  lng,
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(300).optional(),
  /** Texto original do OSM (ex.: "Mo-Fr 08:00-18:00"). O app interpreta para "aberto agora". */
  openingHours: z.string().max(300).optional(),
  /** Atendimento de emergência ou 24 h (pelas marcações do OSM ou pelo nome). */
  emergency: z.boolean(),
});
export type Place = z.infer<typeof placeSchema>;

/** O que o app manda para a função: a posição JÁ arredondada na grade (~1 km). */
export const searchPlacesRequestSchema = z.object({
  lat,
  lng,
  radiusKm: z.union([z.literal(3), z.literal(5), z.literal(10), z.literal(20)]),
});
export type SearchPlacesRequest = z.infer<typeof searchPlacesRequestSchema>;

export const searchPlacesResponseSchema = z.object({
  places: z.array(placeSchema).max(MAX_PLACES),
  provider: z.enum(PLACE_SOURCE),
  /** true quando veio do cache (ninguém consultou o OpenStreetMap de novo). */
  cached: z.boolean(),
});
export type SearchPlacesResponse = z.infer<typeof searchPlacesResponseSchema>;

/* -------------------------------- Favoritos -------------------------------- */

/** IDs do Firestore não aceitam "/": "osm:node/123" vira "osm-node-123". */
export function placeDocKey(placeId: string): string {
  return placeId.replace(/[/:]/g, '-').slice(0, 120);
}

/** `favorite_places/{uid}_{placeKey}`: determinístico, então favoritar duas vezes não duplica. */
export function favoritePlaceId(uid: string, placeId: string): string {
  return `${uid}_${placeDocKey(placeId)}`;
}

/** Cópia do local no momento em que foi favoritado (funciona sem nova busca e aparece nos medicamentos). */
export const favoritePlaceSchema = z.object({
  ownerId: z.string().min(1),
  placeId: z.string().min(1).max(120),
  source: z.enum(PLACE_SOURCE),
  name: z.string().min(1).max(120),
  category: z.enum(PLACE_CATEGORY),
  lat,
  lng,
  address: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  openingHours: z.string().max(300).optional(),
  emergency: z.boolean(),
  createdAt: z.unknown().optional(),
});
export type FavoritePlaceDoc = z.infer<typeof favoritePlaceSchema>;
export type FavoritePlace = FavoritePlaceDoc & { id: string };

/* -------------------------------- Sugestões -------------------------------- */

export const SUGGESTION_KIND = ['new', 'fix'] as const;
export const MAX_SUGGESTIONS_PER_DAY = 10;

const required = { message: 'validation.required' };
const tooLong = { message: 'validation.tooLong' };

/** Formulário "Sugerir um local" / "Corrigir dados" (fica pendente de moderação). */
export const placeSuggestionFormSchema = z
  .object({
    kind: z.enum(SUGGESTION_KIND),
    /** Só em "corrigir": o local que está errado. */
    placeId: z.string().max(120),
    name: z.string().trim().min(1, required).max(120, tooLong),
    category: z.enum(PLACE_CATEGORY),
    address: z.string().trim().min(1, required).max(200, tooLong),
    phone: z.string().trim().max(40, tooLong),
    is24h: z.boolean(),
    note: z.string().trim().max(500, tooLong),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'fix' && v.placeId === '') ctx.addIssue({ code: 'custom', path: ['placeId'], message: 'validation.required' });
    if (v.phone !== '' && !/^[\d\s()+-]{8,20}$/.test(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'validation.phoneInvalid' });
  });
export type PlaceSuggestionForm = z.infer<typeof placeSuggestionFormSchema>;

/** O que vai para a Cloud Function `suggestPlace` (os mesmos campos, já validados). */
export const placeSuggestionRequestSchema = z.object({
  kind: z.enum(SUGGESTION_KIND),
  placeId: z.string().max(120).optional(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(PLACE_CATEGORY),
  address: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  is24h: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
export type PlaceSuggestionRequest = z.infer<typeof placeSuggestionRequestSchema>;

export function suggestionFormToRequest(v: PlaceSuggestionForm): PlaceSuggestionRequest {
  return {
    kind: v.kind,
    ...(v.kind === 'fix' && v.placeId ? { placeId: v.placeId } : {}),
    name: v.name.trim(),
    category: v.category,
    address: v.address.trim(),
    ...(v.phone.trim() ? { phone: v.phone.trim() } : {}),
    is24h: v.is24h,
    ...(v.note.trim() ? { note: v.note.trim() } : {}),
  };
}
