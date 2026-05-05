// controllers/deliveryFeeController.js
// Handles delivery fee quotes and seller delivery settings

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const { haversineKm, calculateDeliveryFee } = require('../utils/distance');

/**
 * @route   GET /api/delivery/quote
 * @desc    Calculate delivery fee for a store before checkout
 * @access  Private
 * @query   storeId, buyerLat, buyerLng
 */
const getDeliveryQuote = async (req, res, next) => {
    try {
        const { storeId, buyerLat, buyerLng } = req.query;

        if (!storeId || buyerLat === undefined || buyerLng === undefined) {
            return res.status(400).json({
                success: false,
                error: 'storeId, buyerLat, and buyerLng are required'
            });
        }

        const lat = parseFloat(buyerLat);
        const lng = parseFloat(buyerLng);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinates'
            });
        }

        const store = await repositories.stores.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }

        // Store must have coordinates to calculate distance
        if (store.latitude === null || store.longitude === null) {
            // Fall back to base fee only when store has no location set
            return res.status(200).json({
                success: true,
                quote: {
                    storeId,
                    distanceKm: null,
                    deliveryFee: parseFloat(store.delivery_base_fee) || 0,
                    withinRange: true,
                    note: 'Store location not set — flat base fee applied'
                }
            });
        }

        const distanceKm = haversineKm(
            parseFloat(store.latitude),
            parseFloat(store.longitude),
            lat,
            lng
        );

        const { fee, withinRange } = calculateDeliveryFee(store, distanceKm);

        if (!withinRange) {
            return res.status(200).json({
                success: true,
                quote: {
                    storeId,
                    distanceKm,
                    deliveryFee: null,
                    withinRange: false,
                    note: `This store only delivers within ${store.delivery_max_km} km. You are ${distanceKm} km away.`
                }
            });
        }

        res.status(200).json({
            success: true,
            quote: {
                storeId,
                distanceKm,
                deliveryFee: fee,
                withinRange: true,
                breakdown: {
                    baseFee: parseFloat(store.delivery_base_fee) || 0,
                    perKmFee: parseFloat(store.delivery_per_km_fee) || 0,
                    distanceKm
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   PUT /api/business/:storeId/delivery-settings
 * @desc    Seller updates delivery fee configuration for their store
 * @access  Private (Seller — must own the store)
 */
const updateDeliverySettings = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;
        const { deliveryBaseFee, deliveryPerKmFee, deliveryMaxKm } = req.body;

        // Validate inputs
        if (deliveryBaseFee !== undefined && (isNaN(deliveryBaseFee) || parseFloat(deliveryBaseFee) < 0)) {
            return res.status(400).json({ success: false, error: 'deliveryBaseFee must be a non-negative number' });
        }
        if (deliveryPerKmFee !== undefined && (isNaN(deliveryPerKmFee) || parseFloat(deliveryPerKmFee) < 0)) {
            return res.status(400).json({ success: false, error: 'deliveryPerKmFee must be a non-negative number' });
        }
        if (deliveryMaxKm !== undefined && deliveryMaxKm !== null && (isNaN(deliveryMaxKm) || parseFloat(deliveryMaxKm) <= 0)) {
            return res.status(400).json({ success: false, error: 'deliveryMaxKm must be a positive number or null' });
        }

        // Verify ownership
        const store = await repositories.stores.findById(storeId);
        if (!store) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }
        if (store.owner_id !== userId && !req.user.roles?.includes('admin')) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this store' });
        }

        // Build update payload — only update fields that were provided
        const updates = {};
        if (deliveryBaseFee !== undefined)  updates.delivery_base_fee  = parseFloat(deliveryBaseFee);
        if (deliveryPerKmFee !== undefined) updates.delivery_per_km_fee = parseFloat(deliveryPerKmFee);
        if ('deliveryMaxKm' in req.body)    updates.delivery_max_km    = deliveryMaxKm === null ? null : parseFloat(deliveryMaxKm);

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
