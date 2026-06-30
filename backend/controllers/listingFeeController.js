const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const ApiResponse = require('../utils/apiResponse');

const getListingFees = async (req, res, next) => {
  try {
    const [freeLimitConfig, listingFeeConfig] = await Promise.all([
      repositories.feeConfig.getByKey('listing_free_product_limit'),
      repositories.feeConfig.getByKey('listing_fee_amount')
    ]);
    const freeLimit = freeLimitConfig ? Number(freeLimitConfig.config_value) : 10;
    const listingFeeAmount = listingFeeConfig ? Number(listingFeeConfig.config_value) : 50;

    const db = repositories.stores.db;
    const { data: stores, error } = await db
      .from('stores')
      .select('id, name, owner_id, listing_tier, listing_fee_paid_at, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[ListingFees] Failed to fetch stores:', error);
      return ApiResponse.error(res, 'Failed to fetch stores', 500);
    }

    const storeIds = stores.map(s => s.id);
    const productCounts = {};

    if (storeIds.length > 0) {
      const { data: counts } = await db
        .from('products')
        .select('store_id')
        .in('store_id', storeIds)
        .is('deleted_at', null);

      if (counts) {
        counts.forEach(p => {
          productCounts[p.store_id] = (productCounts[p.store_id] || 0) + 1;
        });
      }
    }

    const storeRows = stores.map(store => ({
      id: store.id,
      name: store.name,
      owner_id: store.owner_id,
      listing_tier: store.listing_tier || 'free',
      product_count: productCounts[store.id] || 0,
      free_limit: freeLimit,
      listing_fee_paid_at: store.listing_fee_paid_at,
      status: store.status,
    }));

    const totalStores = storeRows.length;
    const freeTier = storeRows.filter(s => s.listing_tier === 'free').length;
    const paidTier = storeRows.filter(s => s.listing_tier === 'paid').length;
    const approachingLimit = storeRows.filter(
      s => s.listing_tier === 'free' && s.product_count >= Math.floor(freeLimit * 0.8) && s.product_count < freeLimit
    ).length;
    const atLimit = storeRows.filter(
      s => s.listing_tier === 'free' && s.product_count >= freeLimit
    ).length;

    ApiResponse.success(res, {
      summary: {
        total_stores: totalStores,
        free_tier: freeTier,
        paid_tier: paidTier,
        approaching_limit: approachingLimit,
        at_limit: atLimit,
        free_limit: freeLimit,
        listing_fee_amount: listingFeeAmount,
      },
      stores: storeRows,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getListingFees,
};
