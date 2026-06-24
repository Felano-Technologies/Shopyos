// utils/distance.js
// Haversine formula â€” calculates straight-line distance between two GPS coordinates.
// Accurate enough for delivery fee estimates without any external API calls.

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the distance in kilometres between two lat/lng points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometres, rounded to 2 decimal places
 */
function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Calculate the delivery fee for an order based on store settings and distance.
 * Bolt model: fee = base_fee + distance_km × per_km_rate (floor only, no ceiling).
 * @param {Object} store - Store record with delivery_base_fee, delivery_per_km_fee
 * @param {number} distanceKm
 * @param {number} [defaultPerKmFee=0] - Platform fallback per-km rate when store hasn't set one
 * @returns {{ fee: number, withinRange: true, distanceKm: number }}
 */
function calculateDeliveryFee(store, distanceKm, defaultPerKmFee = 0) {
    const baseFee = Number.parseFloat(store.delivery_base_fee) || 0;
    const perKmFee = Number.parseFloat(store.delivery_per_km_fee) || defaultPerKmFee;
    const rawFee = Math.round((baseFee + distanceKm * perKmFee) * 100) / 100;

    return { fee: rawFee, withinRange: true, distanceKm };
}

module.exports = { haversineKm, calculateDeliveryFee };
