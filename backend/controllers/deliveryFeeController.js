// controllers/deliveryFeeController.js
// Handles delivery fee quotes and seller delivery settings

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { haversineKm, calculateDeliveryFee } = require('../utils/distance');
const feeConfigService = require('../services/feeConfigService');

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
    const hasStoreCoords = store.latitude !== null && store.longitude !== null;
    const hasBuyerCoords = buyerLat !== undefined && buyerLng !== undefined;

    if (!hasStoreCoords || !hasBuyerCoords) {
        return { fee: baseFee, distanceKm: null, withinRange: true, note: '' };
    }

    const lat = Number.parseFloat(buyerLat);
    const lng = Number.parseFloat(buyerLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return { fee: baseFee, distanceKm: null, withinRange: true, note: '' };
    }

    const distanceKm = haversineKm(Number.parseFloat(store.latitude), Number.parseFloat(store.longitude), lat, lng);
    const calc = calculateDeliveryFee(store, distanceKm, defaultPerKmFee);
    const fee = calc.fee ?? baseFee;
    return { fee, distanceKm, withinRange: true, note: '' };
}

const getDeliveryQuote = async (req, res, next) => {
    try {
        const { storeId, buyerLat, buyerLng, deliveryState } = req.query;

        if (!storeId) {
            return res.status(400).json({ success: false, error: 'storeId is required' });
        }

        const store = await repositories.stores.findById(storeId);
        if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

        const { fee, distanceKm, withinRange, note } = await resolveCoordinateFee(store, buyerLat, buyerLng);

        // Regional pricing logic (Sync with orderController.js)
        const storeRegion = (store.state_province || 'Greater Accra').trim().toLowerCase();
        const targetRegion = (deliveryState || 'Greater Accra').trim().toLowerCase();
        
        let deliveryFee;
        let isInterRegional = false;
        let parcelTransitFee = 0;
        let estimatedTransitDays = null;

        if (storeRegion === targetRegion) {
            // Intra-regional: distance from store to buyer — floor only, no ceiling (Bolt model)
            const minIntra = await feeConfigService.get('delivery_intra_min_fee');
            deliveryFee = Math.max(minIntra, fee);
        } else {
            // Inter-regional: fee is store → origin hub only (buyer end handled by parcel partner)
            isInterRegional = true;

            const originHub = repositories.parcelPartner
                ? await repositories.parcelPartner.getHubByRegionName(store.state_province || 'Greater Accra')
                : null;

            const minIntra = await feeConfigService.get('delivery_intra_min_fee');
            const defaultPerKmFee = await feeConfigService.get('delivery_default_per_km_fee');

            if (originHub?.latitude && originHub?.longitude && store.latitude && store.longitude) {
                // Calculate distance from store to its nearest hub (intra-regional leg)
                const storeToHubKm = haversineKm(
                    Number.parseFloat(store.latitude),
                    Number.parseFloat(store.longitude),
                    Number.parseFloat(originHub.latitude),
                    Number.parseFloat(originHub.longitude)
                );
                const hubCalc = calculateDeliveryFee(store, storeToHubKm, defaultPerKmFee);
                const defaultBase = await feeConfigService.get('delivery_default_base_fee');
                const rawFee = hubCalc.fee ?? (Number.parseFloat(store.delivery_base_fee) || defaultBase);
                deliveryFee = Math.max(minIntra, rawFee);
            } else {
                deliveryFee = minIntra;
            }

            // Fixed hub-to-hub transit fee from parcel_transit_config
            if (repositories.parcelPartner) {
                const transitConfig = await repositories.parcelPartner.getTransitConfig(
                    store.state_province || 'Greater Accra',
                    deliveryState || 'Greater Accra'
                );
                parcelTransitFee = Number(transitConfig?.route_fee ?? await feeConfigService.get('parcel_partner_base_fee'));
                estimatedTransitDays = transitConfig ? transitConfig.transit_days_min : 2;
            } else {
                parcelTransitFee = Number(await feeConfigService.get('parcel_partner_base_fee') || 25);
                estimatedTransitDays = 2;
            }
        }

        res.status(200).json({
            success: true,
            quote: {
                storeId,
                distanceKm,
                deliveryFee,
                isInterRegional,
                parcelTransitFee,
                estimatedTransitDays,
                storeRegion: store.state_province || 'Greater Accra',
                withinRange: true,
                note: ''
            }
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
            return res.status(400).json({ success: false, error: validationError });
        }

        // Verify ownership
        const store = await repositories.stores.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }
        if (store.owner_id !== userId && !req.user.roles?.includes('admin')) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this store' });
        }

        // Build update payload â€” only update fields that were provided
        const updates = {};
        if (deliveryBaseFee !== undefined)  updates.delivery_base_fee  = Number.parseFloat(deliveryBaseFee);
        if (deliveryPerKmFee !== undefined) updates.delivery_per_km_fee = Number.parseFloat(deliveryPerKmFee);
        if ('deliveryMaxKm' in req.body)    updates.delivery_max_km    = deliveryMaxKm === null ? null : Number.parseFloat(deliveryMaxKm);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No delivery settings provided to update' });
        }

        const { data: updatedStore, error } = await repositories.stores.db
            .from('stores')
            .update(updates)
            .eq('id', storeId)
            .select('id, store_name, delivery_base_fee, delivery_per_km_fee, delivery_max_km')
            .single();

        if (error) throw error;

        logger.info(`Delivery settings updated for store ${storeId} by user ${userId}`);

        res.status(200).json({
            success: true,
            message: 'Delivery settings updated',
            deliverySettings: {
                baseFee: updatedStore.delivery_base_fee,
                perKmFee: updatedStore.delivery_per_km_fee,
                maxKm: updatedStore.delivery_max_km
            }
        });
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
            return res.status(404).json({ success: false, error: 'Store not found' });
        }

        if (store.owner_id !== userId && !req.user.roles?.includes('admin')) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        res.status(200).json({
            success: true,
            deliverySettings: {
                baseFee: store.delivery_base_fee,
                perKmFee: store.delivery_per_km_fee,
                maxKm: store.delivery_max_km
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getDeliveryQuote, updateDeliverySettings, getDeliverySettings };
