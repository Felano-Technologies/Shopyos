// controllers/deliveryFeeController.js
// Handles delivery fee quotes and seller delivery settings

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { haversineKm, calculateDeliveryFee } = require('../utils/distance');
const feeConfigService = require('../services/feeConfigService');
const { resolveStoreRegion, resolveStoreCoords } = require('../utils/ghanaRegions');

/**
 * @route   GET /api/delivery/quote
 * @desc    Calculate delivery fee for a store before checkout
 * @access  Private
 * @query   storeId, buyerLat, buyerLng, deliveryState
 */
async function resolveCoordinateFee(store, buyerLat, buyerLng) {
    const defaultBaseFee = await feeConfigService.get('delivery_default_base_fee');
    const defaultPerKmFee = await feeConfigService.get('delivery_default_per_km_fee');
    const baseFee = Number.parseFloat(store.delivery_base_fee) || defaultBaseFee;
    // Falls back to the owner's last login coords when the seller never
    // pinned the store's own location — same chain used for region
    // resolution below, kept in sync so the quote here matches what
    // orderController.js actually charges at order creation.
    const { lat: storeLat, lng: storeLng } = await resolveStoreCoords(store, repositories);
    const hasStoreCoords = storeLat !== null && storeLng !== null;
    const hasBuyerCoords = buyerLat !== undefined && buyerLng !== undefined;

    if (!hasStoreCoords || !hasBuyerCoords) {
        return { fee: baseFee, distanceKm: null, withinRange: true, note: 'Location not provided – using base fee' };
    }

    const lat = Number.parseFloat(buyerLat);
    const lng = Number.parseFloat(buyerLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return { fee: baseFee, distanceKm: null, withinRange: true, note: 'Location not provided – using base fee' };
    }

    const distanceKm = haversineKm(Number.parseFloat(storeLat), Number.parseFloat(storeLng), lat, lng);
    const calc = calculateDeliveryFee(store, distanceKm, defaultPerKmFee);
    if (calc.withinRange === false) {
        return {
            fee: null,
            distanceKm,
            withinRange: false,
            note: `You are ${distanceKm.toFixed(2)} km away — outside this store's delivery range`
        };
    }
    const fee = calc.fee ?? baseFee;
    return { fee, distanceKm, withinRange: true, note: '' };
}

const getDeliveryQuote = async (req, res, next) => {
    try {
        const { storeId, buyerLat, buyerLng, deliveryState } = req.query;

        if (!storeId) {
            return ApiResponse.error(res, 'storeId is required', 400);
        }

        const store = await repositories.stores.findById(storeId);
        if (!store) return ApiResponse.error(res, 'Store not found', 404);

        const { fee, distanceKm, withinRange, note } = await resolveCoordinateFee(store, buyerLat, buyerLng);

        // Regional pricing logic (Sync with orderController.js)
        // Falls back to store coords, then the owner's last login coords,
        // when the seller never set a region — no hard-coded region default.
        const resolvedRegion = await resolveStoreRegion(store, repositories);
        const storeRegion = resolvedRegion?.trim().toLowerCase() || null;
        const targetRegion = (deliveryState || '').trim().toLowerCase();

        let deliveryFee = null;
        let isInterRegional = false;
        let parcelTransitFee = 0;
        let lastMileFee = 0;
        let estimatedTransitDays = null;
        let estimatedTransitDaysMax = null;

        if (!withinRange) {
            // Buyer is outside the store's delivery radius — no fee to quote
        } else if (!storeRegion || !targetRegion || storeRegion === targetRegion) {
            // Intra-regional: distance from store to buyer — floor only, no ceiling (Bolt model)
            const minIntra = await feeConfigService.get('delivery_intra_min_fee');
            deliveryFee = Math.max(minIntra, fee);
        } else {
            // Inter-regional: fee is store → origin hub only (buyer end handled by parcel partner)
            isInterRegional = true;

            const originHub = repositories.parcelPartner
                ? await repositories.parcelPartner.getHubByRegionName(resolvedRegion)
                : null;

            const minInter = await feeConfigService.get('delivery_inter_min_fee');
            const defaultPerKmFee = await feeConfigService.get('delivery_default_per_km_fee');

            const { lat: storeLatForHub, lng: storeLngForHub } = await resolveStoreCoords(store, repositories);
            if (originHub?.latitude && originHub?.longitude && storeLatForHub != null && storeLngForHub != null) {
                // Calculate distance from store to its nearest hub (intra-regional leg)
                const storeToHubKm = haversineKm(
                    Number.parseFloat(storeLatForHub),
                    Number.parseFloat(storeLngForHub),
                    Number.parseFloat(originHub.latitude),
                    Number.parseFloat(originHub.longitude)
                );
                const hubCalc = calculateDeliveryFee(store, storeToHubKm, defaultPerKmFee);
                const defaultBase = await feeConfigService.get('delivery_default_base_fee');
                const rawFee = hubCalc.fee ?? (Number.parseFloat(store.delivery_base_fee) || defaultBase);
                deliveryFee = Math.max(minInter, rawFee);
            } else {
                deliveryFee = Math.max(minInter, fee ?? 0);
            }

            // Fixed hub-to-hub transit fee from parcel_transit_config
            if (repositories.parcelPartner) {
                const transitConfig = await repositories.parcelPartner.getTransitConfig(
                    resolvedRegion,
                    deliveryState
                );
                parcelTransitFee = Number(transitConfig?.route_fee ?? await feeConfigService.get('parcel_partner_base_fee'));
                // +1 covers hub processing on both ends — raw route numbers
                // only measure hub-to-hub transit
                estimatedTransitDays = (transitConfig ? transitConfig.transit_days_min : 2) + 1;
                estimatedTransitDaysMax = (transitConfig ? (transitConfig.transit_days_max ?? transitConfig.transit_days_min + 1) : 3) + 1;
            } else {
                parcelTransitFee = Number(await feeConfigService.get('parcel_partner_base_fee') || 25);
                estimatedTransitDays = 3;
                estimatedTransitDaysMax = 4;
            }

            // Last-mile estimate (destination hub → buyer) — same base+per-km
            // model as the store→hub leg, so it's a real distance-based
            // number instead of the flat default. Sync with
            // orderController.js's calcLastMileFee (the authoritative charge
            // computed again, server-side, at order creation).
            const destHub = repositories.parcelPartner
                ? await repositories.parcelPartner.getHubByRegionName(deliveryState)
                : null;
            const lastMileBase = await feeConfigService.get('last_mile_default_fee', 15);
            if (destHub?.latitude != null && destHub?.longitude != null && buyerLat !== undefined && buyerLng !== undefined) {
                const lastMilePerKm = await feeConfigService.get('last_mile_per_km_fee', 2);
                const hubToBuyerKm = haversineKm(
                    Number.parseFloat(destHub.latitude), Number.parseFloat(destHub.longitude),
                    Number.parseFloat(buyerLat), Number.parseFloat(buyerLng)
                );
                lastMileFee = Number.parseFloat((lastMileBase + hubToBuyerKm * lastMilePerKm).toFixed(2));
            } else {
                lastMileFee = lastMileBase;
            }
        }

        // Buyer-facing single combined delivery cost — the store→hub leg and
        // the hub→hub courier leg are tracked separately for internal/admin
        // reporting, but shown to the buyer as one number so they aren't
        // confused by two "delivery" line items for what feels like one trip.
        const combinedDeliveryFee = deliveryFee != null ? Number((deliveryFee + parcelTransitFee).toFixed(2)) : null;

        ApiResponse.withEntity(res, 'quote', {
            storeId,
            distanceKm,
            deliveryFee,
            combinedDeliveryFee,
            isInterRegional,
            parcelTransitFee,
            lastMileFee,
            estimatedTransitDays,
            estimatedTransitDaysMax,
            storeRegion: resolvedRegion,
            withinRange,
            note
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @route   PUT /api/business/:storeId/delivery-settings
 * @desc    Seller updates delivery fee configuration for their store
 * @access  Private (Seller â€” must own the store)
 */
function validateDeliverySettings({ deliveryBaseFee, deliveryPerKmFee, deliveryMaxKm }) {
    if (deliveryBaseFee !== undefined && (!Number.isFinite(Number(deliveryBaseFee)) || Number.parseFloat(deliveryBaseFee) < 0)) {
        return 'deliveryBaseFee must be a valid non-negative number';
    }
    if (deliveryPerKmFee !== undefined && (!Number.isFinite(Number(deliveryPerKmFee)) || Number.parseFloat(deliveryPerKmFee) < 0)) {
        return 'deliveryPerKmFee must be a valid non-negative number';
    }
    if (deliveryMaxKm !== undefined && deliveryMaxKm !== null && (!Number.isFinite(Number(deliveryMaxKm)) || Number.parseFloat(deliveryMaxKm) <= 0)) {
        return 'deliveryMaxKm must be a valid positive number or null';
    }
    return null;
}

const updateDeliverySettings = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;
        const { deliveryBaseFee, deliveryPerKmFee, deliveryMaxKm } = req.body;

        const validationError = validateDeliverySettings({ deliveryBaseFee, deliveryPerKmFee, deliveryMaxKm });
        if (validationError) {
            return ApiResponse.error(res, validationError, 400);
        }

        // Verify ownership
        const store = await repositories.stores.findById(storeId);
        if (!store) {
            return ApiResponse.error(res, 'Store not found', 404);
        }
        if (store.owner_id !== userId && !req.user.roles?.includes('admin')) {
            return ApiResponse.error(res, 'Not authorized to update this store', 403);
        }

        // Build update payload â€” only update fields that were provided
        const updates = {};
        if (deliveryBaseFee !== undefined)  updates.delivery_base_fee  = Number.parseFloat(deliveryBaseFee);
        if (deliveryPerKmFee !== undefined) updates.delivery_per_km_fee = Number.parseFloat(deliveryPerKmFee);
        if ('deliveryMaxKm' in req.body)    updates.delivery_max_km    = deliveryMaxKm === null ? null : Number.parseFloat(deliveryMaxKm);

        if (Object.keys(updates).length === 0) {
            return ApiResponse.error(res, 'No delivery settings provided to update', 400);
        }

        const { data: updatedStore, error } = await repositories.stores.db
            .from('stores')
            .update(updates)
            .eq('id', storeId)
            .select('id, store_name, delivery_base_fee, delivery_per_km_fee, delivery_max_km')
            .single();

        if (error) throw error;

        logger.info(`Delivery settings updated for store ${storeId} by user ${userId}`);

        ApiResponse.withEntity(res, 'deliverySettings', {
            baseFee: updatedStore.delivery_base_fee,
            perKmFee: updatedStore.delivery_per_km_fee,
            maxKm: updatedStore.delivery_max_km
        }, 'Delivery settings updated');
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/business/:storeId/delivery-settings
 * @desc    Get a store's delivery fee configuration
 * @access  Private (store owner or admin)
 */
const getDeliverySettings = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;

        const store = await repositories.stores.findById(storeId);
        if (!store) {
            return ApiResponse.error(res, 'Store not found', 404);
        }

        if (store.owner_id !== userId && !req.user.roles?.includes('admin')) {
            return ApiResponse.error(res, 'Not authorized', 403);
        }

        ApiResponse.withEntity(res, 'deliverySettings', {
            baseFee: store.delivery_base_fee,
            perKmFee: store.delivery_per_km_fee,
            maxKm: store.delivery_max_km
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getDeliveryQuote, updateDeliverySettings, getDeliverySettings };
