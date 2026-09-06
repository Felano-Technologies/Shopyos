import { create } from 'zustand';
import * as Location from 'expo-location';
import { storage } from '@/services/storage';
import { requestForegroundLocationWithDisclosure, getCurrentLocation } from '@/src/utils/location';
import { updateUserLocation } from '@/services/auth';

const STORAGE_KEY = 'USER_LOCATION';

type Coords = { lat: number; lng: number };

type LocationStore = {
  coords: Coords | null;
  addressText: string;
  isLoading: boolean;
  // Manual pin confirm (map picker) or a background/live-GPS refresh —
  // reverse-geocodes itself when no text is supplied, persists, and updates
  // in-memory state, so every caller (cart, checkout, home, the background
  // task) gets identical behavior instead of each reimplementing it.
  setLocation: (coords: Coords, addressText?: string) => Promise<void>;
  // Called once (e.g. on home mount) when there's no location yet at all —
  // tries live GPS + reverse-geocode, else falls back to the given city/country
  // text. No-ops if a location is already known (persisted or set this session).
  ensureLocation: (fallbackCityCountry?: string) => Promise<void>;
};

async function reverseGeocode(coords: Coords): Promise<string> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng });
    if (place) {
      const primary = place.city ?? place.region ?? place.country ?? 'Unknown';
      const suffix = place.country ? `, ${place.country}` : '';
      return `${primary}${suffix}`;
    }
  } catch {
    // geocoder unavailable — fall through to raw coordinates
  }
  return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  coords: null,
  addressText: '',
  isLoading: false,

  setLocation: async (coords, addressText) => {
    const text = addressText ?? await reverseGeocode(coords);
    set({ coords, addressText: text, isLoading: false });
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify({ coords, addressText: text }));
    } catch {
      // persistence best-effort — in-memory state is already correct
    }
    // Also sync to the backend (users.latitude/longitude) — best-effort and
    // non-blocking, same PUT /auth/location the login flow already uses, so
    // the buyer's location isn't only a local-device cache: it survives a
    // reinstall/new device via the profile, not just AsyncStorage.
    updateUserLocation(coords.lat, coords.lng).catch(() => {});
  },

  ensureLocation: async (fallbackCityCountry) => {
    if (get().coords) return;
    set({ isLoading: true });
    try {
      const { status } = await requestForegroundLocationWithDisclosure();
      if (status === Location.PermissionStatus.GRANTED) {
        const live = await getCurrentLocation();
        if (live) {
          await get().setLocation({ lat: live.latitude, lng: live.longitude });
          return;
        }
      }
      if (fallbackCityCountry) {
        set({ addressText: fallbackCityCountry, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));

/**
 * Load the last-known persisted location before first paint, so home/cart/
 * checkout never flash "Locating…" for a buyer who already picked one.
 * Call once from RootLayout, mirroring hydrateThemeLocal.
 */
export async function hydrateLocationLocal(): Promise<void> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.coords) {
      useLocationStore.setState({ coords: parsed.coords, addressText: parsed.addressText || '' });
    }
  } catch {
    // Corrupt/missing cache — leave state at defaults, ensureLocation will refetch.
  }
}
