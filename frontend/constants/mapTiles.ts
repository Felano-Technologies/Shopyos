/**
 * Shared OSM raster tile URL template for every in-app <UrlTile>.
 *
 * Previously every map screen pointed straight at tile.openstreetmap.org —
 * the community "demo" tile server, which explicitly disallows/throttles
 * production app traffic and is the main cause of maps loading slowly or
 * getting stuck. Stadia Maps serves the exact same OpenStreetMap data via a
 * CDN meant for real apps (free tier, no credit card).
 *
 * Sign up at https://stadiamaps.com, grab a free API key, and set
 * EXPO_PUBLIC_STADIA_API_KEY in .env. Falls back to the old raw OSM server
 * (today's behavior) if no key is configured yet, so this doesn't break
 * anything before that key exists.
 */
const STADIA_API_KEY = process.env.EXPO_PUBLIC_STADIA_API_KEY;

export const OSM_TILE_URL_TEMPLATE = STADIA_API_KEY
  ? `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key=${STADIA_API_KEY}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
