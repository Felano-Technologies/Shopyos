// utils/ghanaRegions.ts
// Canonical Ghana region list (kept in sync with backend/utils/ghanaRegions.js)
// with approximate regional-capital coordinates for coords → region resolution.

export const GHANA_REGIONS = [
  'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central',
  'Northern', 'Volta', 'Upper East', 'Upper West', 'Brong-Ahafo',
  'Oti', 'Bono East', 'Ahafo', 'Savannah', 'North East', 'Western North',
] as const;

const REGION_CENTROIDS: { name: string; lat: number; lng: number }[] = [
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Nearest Ghana region by distance to the regional capital. */
export function nearestGhanaRegion(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) return null;
  let best: string | null = null;
  let bestKm = Infinity;
  for (const r of REGION_CENTROIDS) {
    const km = haversineKm(Number(lat), Number(lng), r.lat, r.lng);
    if (km < bestKm) { bestKm = km; best = r.name; }
  }
  return best;
}

/** Loose match of a free-text region name (e.g. from IP geolocation) to the canonical list. */
export function mapTextToGhanaRegion(raw: string): string | null {
  const r = (raw || '').toLowerCase();
  return GHANA_REGIONS.find(g => r.includes(g.toLowerCase())) ?? null;
}
