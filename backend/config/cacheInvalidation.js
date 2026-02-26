const { cacheDel, cacheDelPattern } = require('../config/redis');
const { logger } = require('../config/logger');

const invalidateProduct = async (productId, storeId) => {
    const keys = [`shopyos:products:detail:${productId}`];
    if (storeId) keys.push(`shopyos:products:store:${storeId}:*`);

    await Promise.all([
        cacheDel(keys.filter(k => !k.includes('*'))),
        ...keys.filter(k => k.includes('*')).map(k => cacheDelPattern(k)),
        cacheDelPattern('shopyos:products:search:*'),
        cacheDelPattern('shopyos:categories:*')
    ]);
    logger.debug('Cache invalidated: product', { productId, storeId });
};

const invalidateStore = async (storeId) => {
    await Promise.all([
        cacheDel(`shopyos:stores:detail:${storeId}`),
        cacheDelPattern('shopyos:stores:all:*'),
        cacheDel('shopyos:stores:featured')
    ]);
    logger.debug('Cache invalidated: store', { storeId });
};

const invalidateCategories = async () => {
    await cacheDelPattern('shopyos:categories:*');
    logger.debug('Cache invalidated: categories');
};

const invalidateReviews = async (productId, storeId) => {
    const ops = [];
    if (productId) {
        ops.push(cacheDelPattern(`shopyos:reviews:product:${productId}:*`));
        ops.push(cacheDel(`shopyos:products:detail:${productId}`));
    }
    if (storeId) {
        ops.push(cacheDelPattern(`shopyos:reviews:store:${storeId}:*`));
    }
    await Promise.all(ops);
    logger.debug('Cache invalidated: reviews', { productId, storeId });
};

// Invalidate product detail caches for each item in an order (stock/sales count changed)
const invalidateOrderProducts = async (items, storeId) => {
    const ops = items.map(item => cacheDel(`shopyos:products:detail:${item.product_id}`));
    if (storeId) ops.push(cacheDelPattern(`shopyos:products:store:${storeId}:*`));
    ops.push(cacheDelPattern('shopyos:products:search:*'));
    await Promise.all(ops);
    logger.debug('Cache invalidated: order products', { itemCount: items.length });
};

module.exports = {
    invalidateProduct,
    invalidateStore,
    invalidateCategories,
    invalidateReviews,
    invalidateOrderProducts
};
