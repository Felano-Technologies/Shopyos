// controllers/payoutController.js
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const paystackService = require('../services/paystackService');

// @desc    Request a payout
// @route   POST /api/payouts/request
// @access  Private (Seller)
const requestPayout = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Get payout history
// @route   GET /api/payouts/history/:storeId
// @access  Private (Seller)
const getPayoutHistory = async (req, res, next) => {
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
        next(error);
    }
};

// @desc    Process a payout (Admin)
// @route   PUT /api/payouts/:payoutId/process
// @access  Private (Admin)
const processPayout = async (req, res, next) => {
    try {
        const { payoutId } = req.params;
        const { action } = req.body; // 'approve' or 'reject'
        const userId = req.user.id;

        const isAdmin = await repositories.users.hasRole(userId, 'admin');
        if (!isAdmin) return res.status(403).json({ success: false, error: 'Not authorized' });

        const payout = await repositories.payouts.findById(payoutId);
        if (!payout) return res.status(404).json({ success: false, error: 'Payout not found' });
        if (payout.status !== 'pending') return res.status(400).json({ success: false, error: 'Payout is not in pending status' });

        if (action === 'reject') {
            const updated = await repositories.payouts.updatePayoutStatus(payoutId, 'failed', { notes: 'Rejected by admin' });
            
            // Refund the store balance
            const store = await repositories.stores.findById(payout.store_id);
            const newBalance = parseFloat(store.current_balance || 0) + parseFloat(payout.amount);
            await repositories.stores.update(store.id, { current_balance: newBalance });
            
            await repositories.stores.db.from('balance_logs').insert({
                store_id: store.id,
                amount: parseFloat(payout.amount),
                transaction_type: 'adjustment',
                notes: 'Payout refund due to rejection',
                balance_after: newBalance
            });

            return res.status(200).json({ success: true, message: 'Payout rejected and refunded', payout: updated });
        }

        // Action is 'approve' - Trigger Paystack Transfer
        const details = payout.payout_details;
        let recipientCode = details.recipient_code;

        if (!recipientCode) {
            recipientCode = await paystackService.createTransferRecipient({
                name: details.name || 'Store Owner',
                account_number: details.account_number,
                bank_code: details.bank_code,
                currency: 'GHS'
            });
        }

        const transfer = await paystackService.initiateTransfer({
            amount: payout.amount,
            recipient: recipientCode,
            reason: `Payout for store ID ${payout.store_id}`
        });

        const updated = await repositories.payouts.updatePayoutStatus(payoutId, 'processing', {
            transactionReference: transfer.reference,
            notes: `Transfer initiated. Paystack Ref: ${transfer.reference}`
        });

        res.status(200).json({
            success: true,
            message: 'Payout processing initiated via Paystack',
            payout: updated,
            transfer
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    requestPayout,
    getPayoutHistory,
    processPayout
};
