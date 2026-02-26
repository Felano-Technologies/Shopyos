// controllers/payoutController.js
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

// @desc    Request a payout
// @route   POST /api/payouts/request
// @access  Private (Seller)
const requestPayout = async (req, res) => {
    try {
        const { storeId, amount, method, details } = req.body;
        const userId = req.user.id;

        if (!storeId || !amount || !method) {
            return res.status(400).json({ success: false, error: 'Store ID, amount, and method are required' });
        }

        // Verify ownership
        const store = await repositories.stores.findById(storeId);
        if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
        if (store.owner_id !== userId) return res.status(403).json({ success: false, error: 'Not authorized' });

        // Check balance
        const currentBalance = parseFloat(store.current_balance || 0);
        if (amount > currentBalance) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // Create payout record
        const payout = await repositories.payouts.requestPayout({
            storeId,
            amount,
            method,
            details
        });

        // Update store balance (deduct)
        await repositories.stores.update(storeId, {
            current_balance: currentBalance - amount
        });

        // Log balance change
        await repositories.stores.db.from('balance_logs').insert({
            store_id: storeId,
            amount: -amount,
            transaction_type: 'withdrawal',
            payout_id: payout.id,
            balance_after: currentBalance - amount
        });

        res.status(201).json({
            success: true,
            message: 'Payout requested successfully',
            payout
        });

    } catch (error) {
        logger.error('Error requesting payout:', { error: error.message });
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get payout history
// @route   GET /api/payouts/history/:storeId
// @access  Private (Seller)
const getPayoutHistory = async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;
        const { status, limit, offset } = req.query;

        // Verify ownership
        const store = await repositories.stores.findById(storeId);
        if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
        if (store.owner_id !== userId) return res.status(403).json({ success: false, error: 'Not authorized' });

        const history = await repositories.payouts.getStorePayouts(storeId, { status, limit, offset });

        res.status(200).json({
            success: true,
            data: history
        });

    } catch (error) {
        logger.error('Error fetching payout history:', { error: error.message });
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

module.exports = {
    requestPayout,
    getPayoutHistory
};
