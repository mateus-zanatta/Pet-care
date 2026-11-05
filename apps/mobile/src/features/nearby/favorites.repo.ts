import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@react-native-firebase/firestore';
import { type FavoritePlace, type Place, favoritePlaceId, favoritePlaceSchema } from '@petcare/shared';
import { db } from '@/core/firebase';
import { settleOrOffline } from '@/core/firebase/settle';

export function subscribeFavorites(uid: string, onData: (items: FavoritePlace[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(collection(db(), 'favorite_places'), where('ownerId', '==', uid)),
    (snap) =>
      onData(
        snap.docs
          .map((d) => {
            const parsed = favoritePlaceSchema.safeParse(d.data());
            return parsed.success ? { id: d.id, ...parsed.data } : null;
          })
          .filter((f): f is FavoritePlace => f !== null),
      ),
    onError,
  );
}

/**
 * Guarda uma cópia do local (funciona sem nova busca e aparece no campo "local" dos medicamentos).
 * `fallbackName`: o nome a usar quando o local não tem nome no mapa (ex.: "Clínica veterinária").
 */
export function addFavorite(uid: string, place: Place, fallbackName: string) {
  return settleOrOffline(
    setDoc(doc(db(), 'favorite_places', favoritePlaceId(uid, place.id)), {
      ownerId: uid,
      placeId: place.id,
      source: place.source,
      name: (place.name ?? fallbackName).slice(0, 120),
      category: place.category,
      lat: place.lat,
      lng: place.lng,
      emergency: place.emergency,
      ...(place.address ? { address: place.address } : {}),
      ...(place.phone ? { phone: place.phone } : {}),
      ...(place.openingHours ? { openingHours: place.openingHours } : {}),
      createdAt: serverTimestamp(),
    }),
  );
}

export function removeFavorite(uid: string, placeId: string) {
  return settleOrOffline(deleteDoc(doc(db(), 'favorite_places', favoritePlaceId(uid, placeId))));
}
