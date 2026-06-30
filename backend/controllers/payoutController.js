// controllers/payoutController.js
const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const paystackService = require('../services/paystackService');
const feeConfigService = require('../services/feeConfigService');
const { logger } = require('../config/logger');

// ── Helpers ────────────────────────────────────────────────────────────────

async function triggerPaystackTransfer({ payout, name, bankCode, accountNumber, network, phone, currency = 'GHS' }) {
    let recipientCode = payout.payout_details?.recipient_code;

    if (!recipientCode) {
        const isBank = payout.payout_method === 'bank';
        recipientCode = await paystackService.createTransferRecipient({
            type: isBank ? 'nuban' : 'mobile_money',
            name,
            account_number: isBank ? accountNumber : phone,
            bank_code: isBank ? bankCode : network,
            currency
        });
    }

    return paystackService.initiateTransfer({
        amount: payout.amount,
        recipient: recipientCode,
        reason: `Shopyos payout #${payout.id}`
    });
}

// ── Seller: request payout ─────────────────────────────────────────────────

const requestPayout = async (req, res, next) => {
    try {
        const { storeId, amount, method, details } = req.body;
        const userId = req.user.id;

        if (!storeId || !amount || !method) {
            return ApiResponse.error(res, 'Store ID, amount, and method are required', 400);
        }

        const store = await repositories.stores.findById(storeId);
        if (!store) return ApiResponse.error(res, 'Store not found', 404);
        if (store.owner_id !== userId) return ApiResponse.error(res, 'Not authorized', 403);

        const minPayoutAmount = await feeConfigService.get('min_payout_amount');
        if (amount < minPayoutAmount) {
            return ApiResponse.error(res, `Minimum payout request is GHS ${minPayoutAmount}`, 400);
        }

        const currentBalance = Number.parseFloat(store.current_balance || 0);
        if (amount > currentBalance) {
            return ApiResponse.error(res, 'Insufficient balance', 400);
        }

        const hasPending = await repositories.payouts.hasPendingPayout(storeId, null);
        if (hasPending) {
            return ApiResponse.error(res, 'You already have a pending payout request', 400);
        }

        const payout = await repositories.payouts.requestPayout({ storeId, amount, method, details });

        await repositories.stores.update(storeId, { current_balance: currentBalance - amount });
        await repositories.stores.db.from('balance_logs').insert({
            store_id: storeId,
            amount: -amount,
            transaction_type: 'withdrawal',
            payout_id: payout.id,
            balance_after: currentBalance - amount,
            notes: 'Manual payout request'
        });

        ApiResponse.withEntity(res, 'payout', payout, 'Payout requested successfully', null, 201);
    } catch (error) {
        next(error);
    }
};

// ── Seller: payout history ─────────────────────────────────────────────────

const getPayoutHistory = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const { status, search, from, to, limit, offset } = req.query;
        const userId = req.user.id;

        const store = await repositories.stores.findById(storeId);
        if (!store) return ApiResponse.error(res, 'Store not found', 404);
        if (store.owner_id !== userId) return ApiResponse.error(res, 'Not authorized', 403);

        const history = await repositories.payouts.getStorePayouts(storeId, { status, search, from, to, limit, offset });

        ApiResponse.success(res, history);
    } catch (error) {
        next(error);
    }
};

// ── Seller: locked balance entries ────────────────────────────────────────

const getSellerLockedBalance = async (req, res, next) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;

        const store = await repositories.stores.findById(storeId);
        if (!store) return ApiResponse.error(res, 'Store not found', 404);
        if (store.owner_id !== userId) return ApiResponse.error(res, 'Not authorized', 403);

        const db = require('../config/postgres').getPool();
        // Locked = payout_eligible_at in the future OR open return request on that order
        const { rows } = await db.query(`
            SELECT
                bl.id, bl.order_id, bl.amount, bl.payout_eligible_at, bl.created_at,
                o.order_number,
                CASE WHEN rr.id IS NOT NULL THEN true ELSE false END AS has_open_return
            FROM balance_logs bl
            LEFT JOIN orders o ON o.id = bl.order_id
            LEFT JOIN return_requests rr ON rr.order_id = bl.order_id
                AND rr.status IN ('pending', 'seller_approved', 'admin_review')
            WHERE bl.store_id = $1
              AND bl.transaction_type = 'sale'
              AND (bl.payout_eligible_at > NOW() OR rr.id IS NOT NULL)
            ORDER BY bl.created_at DESC
        `, [storeId]);

        const lockedTotal = rows.reduce((sum, r) => sum + Number.parseFloat(r.amount), 0);
        res.json({ success: true, data: rows, lockedTotal });
    } catch (error) {
        next(error);
    }
};

// ── Driver: request payout ────────────────────────────────────────────────

const requestDriverPayout = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { amount } = req.body;

        if (!amount) {
            return ApiResponse.error(res, 'amount is required', 400);
        }

        const profile = await repositories.userProfiles.findByUserId(userId);
        if (!profile) return ApiResponse.error(res, 'Profile not found', 404);

        const minDriverPayout = await feeConfigService.get('min_driver_payout').catch(() => 10);
        if (Number.parseFloat(amount) < minDriverPayout) {
            return ApiResponse.error(res, `Minimum payout amount is GHS ${minDriverPayout}`, 400);
        }

        const currentBalance = Number.parseFloat(profile.wallet_balance || 0);
        if (Number.parseFloat(amount) > currentBalance) {
            return ApiResponse.error(res, 'Insufficient wallet balance', 400);
        }

        if (!profile.payout_method) {
            return ApiResponse.error(res, 'Please set up a payout method first', 400);
        }

        const hasPending = await repositories.payouts.hasPendingPayout(null, userId);
        if (hasPending) {
            return ApiResponse.error(res, 'You already have a pending payout', 400);
        }

        const payout = await repositories.payouts.requestPayout({
            driverId: userId,
            amount: Number.parseFloat(amount),
            method: profile.payout_method,
            details: profile.payout_details
        });

        // Deduct wallet balance
        await repositories.userProfiles.update(userId, {
            wallet_balance: currentBalance - Number.parseFloat(amount)
        });

        await repositories.userProfiles.db.from('wallet_logs').insert({
            user_id: userId,
            amount: -Number.parseFloat(amount),
            transaction_type: 'withdrawal',
            balance_after: currentBalance - Number.parseFloat(amount)
        });

        ApiResponse.withEntity(res, 'payout', payout, 'Payout requested', null, 201);
    } catch (error) {
        next(error);
    }
};

// ── Driver: payout history ────────────────────────────────────────────────

const getDriverPayoutHistory = async (req, res, next) => {
    try {
        const { status, from, to, limit, offset } = req.query;
        const history = await repositories.payouts.getDriverPayouts(req.user.id, { status, from, to, limit, offset });
        ApiResponse.success(res, history);
    } catch (error) {
        next(error);
    }
};

// ── Admin: list all payouts ───────────────────────────────────────────────

const getAdminPayouts = async (req, res, next) => {
    try {
        const isAdmin = await repositories.users.hasRole(req.user.id, 'admin');
        if (!isAdmin) return ApiResponse.error(res, 'Not authorized', 403);

        const { type, status, search, from, to, page = 1, limit = 30 } = req.query;
        const limitNum = Math.min(parseInt(limit) || 30, 100);
        const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

        const { data, count } = await repositories.payouts.getAdminPayouts({ type, status, search, from, to, limit: limitNum, offset });

        ApiResponse.paginated(res, data, {
            totalItems: count,
            totalPages: Math.ceil(count / limitNum),
            currentPage: parseInt(page),
            itemsPerPage: limitNum
        });
    } catch (error) {
        next(error);
    }
};

// ── Admin: summary counts/totals ─────────────────────────────────────────

const getAdminPayoutSummary = async (req, res, next) => {
    try {
        const isAdmin = await repositories.users.hasRole(req.user.id, 'admin');
        if (!isAdmin) return ApiResponse.error(res, 'Not authorized', 403);

        const rows = await repositories.payouts.getAdminPayoutSummary();

        // Shape into { pending: { seller: {count,total}, driver: {count,total} }, processing: {...}, ... }
        const summary = {};
        for (const row of rows) {
            if (!summary[row.status]) summary[row.status] = {};
            summary[row.status][row.payout_type || 'seller'] = {
                count: row.count,
                total: Number.parseFloat(row.total)
            };
        }
        ApiResponse.success(res, summary);
    } catch (error) {
        next(error);
    }
};

// ── Admin: process single payout ─────────────────────────────────────────

const processPayout = async (req, res, next) => {
    try {
        const { payoutId } = req.params;
        const { action } = req.body; // 'approve' or 'reject'

        const isAdmin = await repositories.users.hasRole(req.user.id, 'admin');
        if (!isAdmin) return ApiResponse.error(res, 'Not authorized', 403);

        const payout = await repositories.payouts.findById(payoutId);
        if (!payout) return ApiResponse.error(res, 'Payout not found', 404);
        if (payout.status !== 'pending') return ApiResponse.error(res, 'Payout is not pending', 400);

        if (action === 'reject') {
            const updated = await repositories.payouts.updatePayoutStatus(payoutId, 'failed', { notes: 'Rejected by admin' });
            await _refundPayoutBalance(payout);
            return ApiResponse.withEntity(res, 'payout', updated, 'Payout rejected and refunded');
        }

        // approve → Paystack transfer
        const transfer = await _initiatePayoutTransfer(payout);
        const updated = await repositories.payouts.updatePayoutStatus(payoutId, 'processing', {
            transactionReference: transfer.reference,
            notes: `Transfer initiated. Ref: ${transfer.reference}`
        });

        res.json({ success: true, message: 'Payout processing initiated', payout: updated, transfer });
    } catch (error) {
        next(error);
    }
};

// ── Admin: bulk process payouts ──────────────────────────────────────────

const bulkProcessPayouts = async (req, res, next) => {
    try {
        const { ids, action } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return ApiResponse.error(res, 'ids array is required', 400);
        }
        if (!['approve', 'reject'].includes(action)) {
            return ApiResponse.error(res, "action must be 'approve' or 'reject'", 400);
        }

        const isAdmin = await repositories.users.hasRole(req.user.id, 'admin');
        if (!isAdmin) return ApiResponse.error(res, 'Not authorized', 403);

        const results = await Promise.allSettled(ids.map(async (payoutId) => {
            const payout = await repositories.payouts.findById(payoutId);
            if (!payout || payout.status !== 'pending') return { payoutId, skipped: true };

            if (action === 'reject') {
                await repositories.payouts.updatePayoutStatus(payoutId, 'failed', { notes: 'Bulk rejected by admin' });
                await _refundPayoutBalance(payout);
                return { payoutId, action: 'rejected' };
            }

            const transfer = await _initiatePayoutTransfer(payout);
            await repositories.payouts.updatePayoutStatus(payoutId, 'processing', {
                transactionReference: transfer.reference,
                notes: `Bulk approve. Ref: ${transfer.reference}`
            });
            return { payoutId, action: 'approved', reference: transfer.reference };
        }));

        const processed = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const failed = results.filter(r => r.status === 'rejected').map((r, i) => ({ payoutId: ids[i], error: r.reason?.message }));

        res.json({ success: true, processed, failed });
    } catch (error) {
        next(error);
    }
};

// ── Internal helpers ──────────────────────────────────────────────────────

async function _initiatePayoutTransfer(payout) {
    const details = payout.payout_details || {};
    return paystackService.initiateTransfer({
        amount: payout.amount,
        recipient: details.recipient_code || await paystackService.createTransferRecipient({
            type: payout.payout_method === 'bank' ? 'nuban' : 'mobile_money',
            name: details.name || 'Recipient',
            account_number: details.account_number || details.phone,
            bank_code: details.bank_code || details.network,
            currency: 'GHS'
        }),
        reason: `Shopyos payout #${payout.id}`
    });
}

async function _refundPayoutBalance(payout) {
    try {
        if (payout.store_id) {
            const store = await repositories.stores.findById(payout.store_id);
            const newBalance = Number.parseFloat(store.current_balance || 0) + Number.parseFloat(payout.amount);
            await repositories.stores.update(payout.store_id, { current_balance: newBalance });
            await repositories.stores.db.from('balance_logs').insert({
                store_id: payout.store_id,
                amount: Number.parseFloat(payout.amount),
                transaction_type: 'adjustment',
                payout_id: payout.id,
                balance_after: newBalance,
                notes: 'Payout refunded due to rejection/failure'
            });
        } else if (payout.driver_id) {
            const profile = await repositories.userProfiles.findByUserId(payout.driver_id);
            const newBalance = Number.parseFloat(profile.wallet_balance || 0) + Number.parseFloat(payout.amount);
            await repositories.userProfiles.update(payout.driver_id, { wallet_balance: newBalance });
            await repositories.userProfiles.db.from('wallet_logs').insert({
                user_id: payout.driver_id,
                amount: Number.parseFloat(payout.amount),
                transaction_type: 'adjustment',
                balance_after: newBalance
            });
        }
    } catch (err) {
        logger.error('[Payout] refund balance failed:', err.message);
    }
}

module.exports = {
    requestPayout,
    getPayoutHistory,
    getSellerLockedBalance,
    requestDriverPayout,
    getDriverPayoutHistory,
    getAdminPayouts,
    getAdminPayoutSummary,
    processPayout,
    bulkProcessPayouts,
    // exposed for scheduler & webhook
    _initiatePayoutTransfer,
    _refundPayoutBalance
};
