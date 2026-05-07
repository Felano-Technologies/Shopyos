const repositories = require('../db/repositories');

/**
 * Middleware to ensure the authenticated user has a store
 * and attaches the store object to req.store
 */
const requireStore = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, error: 'Not authorized' });
        }

        const result = await repositories.stores.findByOwnerId(req.user.id);
        const stores = result?.data || [];
        
        if (stores.length === 0) {
            return res.status(403).json({ 
                success: false, 
                error: 'Store not found. You must create a store first.' 
            });
        }

        // Find the first active store, otherwise fall back to the most recent one to show the inactive message
        const store = stores.find(s => s.is_active) || stores[0];

        if (!store.is_active) {
            return res.status(403).json({ 
                success: false, 
                error: 'Your store is currently inactive. Please contact support or wait for approval.' 
            });
        }

        req.store = store;
        next();
    } catch (error) {
        console.error('Error in requireStore middleware:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

module.exports = { requireStore };
