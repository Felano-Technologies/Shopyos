// utils/ghanaRegions.js
// Canonical Ghana region list (matches the frontend GHANA_REGIONS chips) with
// approximate regional-capital coordinates, plus helpers to resolve a store's
// region when the seller never set state_province.

const { haversineKm } = require('./distance');

// Names must match the frontend chip list exactly (checkout + business registration).
const REGION_CENTROIDS = [
  { name: 'Greater Accra',  lat: 5.6037,  lng: -0.1870 },  // Accra
  { name: 'Ashanti',        lat: 6.6885,  lng: -1.6244 },  // Kumasi
  { name: 'Western',        lat: 4.9346,  lng: -1.7137 },  // Sekondi-Takoradi
  { name: 'Eastern',        lat: 6.0940,  lng: -0.2610 },  // Koforidua
  { name: 'Central',        lat: 5.1054,  lng: -1.2466 },  // Cape Coast
  { name: 'Northern',       lat: 9.4008,  lng: -0.8393 },  // Tamale
  { name: 'Volta',          lat: 6.6009,  lng: 0.4713 },   // Ho
  { name: 'Upper East',     lat: 10.7856, lng: -0.8514 },  // Bolgatanga
  { name: 'Upper West',     lat: 10.0601, lng: -2.5099 },  // Wa
  { name: 'Brong-Ahafo',    lat: 7.3349,  lng: -2.3123 },  // Sunyani
  { name: 'Oti',            lat: 8.0670,  lng: 0.1790 },   // Dambai
  { name: 'Bono East',      lat: 7.5909,  lng: -1.9344 },  // Techiman
  { name: 'Ahafo',          lat: 6.8034,  lng: -2.5177 },  // Goaso
  { name: 'Savannah',       lat: 9.0870,  lng: -1.8249 },  // Damongo
  { name: 'North East',     lat: 10.5279, lng: -0.3695 },  // Nalerigu
  { name: 'Western North',  lat: 6.2059,  lng: -2.4855 },  // Sefwi Wiawso
];

/**
 * Nearest region by straight-line distance to the regional capital.
 * Coarse but reliable for "which region am I in" at delivery-pricing granularity.
 */
function nearestRegion(lat, lng) {
  const la = Number.parseFloat(lat);
  const ln = Number.parseFloat(lng);
  if (Number.isNaN(la) || Number.isNaN(ln)) return null;
  let best = null, bestKm = Infinity;
  for (const r of REGION_CENTROIDS) {
    const km = haversineKm(la, ln, r.lat, r.lng);
    if (km < bestKm) { bestKm = km; best = r.name; }
  }
  return best;
}

/**
 * Resolve a store's region for delivery pricing.
 * Order: seller-set state_province → store coordinates → owner's last-known
 * login coordinates (user_profiles.latitude/longitude, captured at login).
 * Returns null only when nothing is available.
 */
async function resolveStoreRegion(store, repositories) {
  if (!store) return null;
  if (store.state_province?.trim()) return store.state_province.trim();

  if (store.latitude != null && store.longitude != null) {
    const byStoreCoords = nearestRegion(store.latitude, store.longitude);
    if (byStoreCoords) return byStoreCoords;
  }

  if (store.owner_id && repositories?.userProfiles) {
    try {
      const profile = await repositories.userProfiles.findByUserId(store.owner_id);
      if (profile?.latitude != null && profile?.longitude != null) {
        return nearestRegion(profile.latitude, profile.longitude);
      }
    } catch { /* fall through — region stays unknown */ }
  }

  return null;
}

/**
 * Resolve store coordinates for distance-based delivery pricing, falling
 * back to the owner's last-known login coordinates (user_profiles.latitude/
 * longitude, captured at login) when the seller never pinned the store's
 * own location — same fallback chain as resolveStoreRegion above, so
 * distance-based fees don't silently stay flat just because a store never
 * got a map pin set.
 * @returns {Promise<{lat: number|null, lng: number|null}>}
 */
async function resolveStoreCoords(store, repositories) {
  if (!store) return { lat: null, lng: null };
  if (store.latitude != null && store.longitude != null) {
    return { lat: store.latitude, lng: store.longitude };
  }

  if (store.owner_id && repositories?.userProfiles) {
    try {
      const profile = await repositories.userProfiles.findByUserId(store.owner_id);
      if (profile?.latitude != null && profile?.longitude != null) {
        return { lat: profile.latitude, lng: profile.longitude };
      }
    } catch { /* fall through — coords stay unknown */ }
  }

  return { lat: null, lng: null };
}

module.exports = { REGION_CENTROIDS, nearestRegion, resolveStoreRegion, resolveStoreCoords };
