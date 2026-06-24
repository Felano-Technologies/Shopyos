// workers/payoutScheduler.js
// Two scheduled auto-payout jobs:
//   Driver job: nightly at 02:00 AM — pays all eligible driver wallets automatically
//   Seller job: Mondays at 06:00 AM — pays sellers whose balance is past the return window

const cron = require('node-cron');
const { logger } = require('../config/logger');
const repositories = require('../db/repositories');
const paystackService = require('../services/paystackService');
const { _refundPayoutBalance } = require('../controllers/payoutController');

let driverJobRunning = false;
let sellerJobRunning = false;

async function runDriverPayouts() {
    if (driverJobRunning) {
        logger.info('[PayoutScheduler] Driver job already running, skipping');
        return;
    }
    driverJobRunning = true;
    logger.info('[PayoutScheduler] Driver nightly payout job started');

    try {
        const db = require('../config/postgres').getPool();

        // Fetch min_driver_payout from config
        const configRes = await db.query(
            `SELECT config_value FROM platform_fee_config WHERE config_key = 'min_driver_payout'`
        );
        const minPayout = configRes.rows[0] ? parseFloat(configRes.rows[0].config_value) : 10;

        // Find all drivers with eligible wallet balance and a payout method set
        const { rows: drivers } = await db.query(`
            SELECT up.user_id, up.wallet_balance, up.payout_method, up.payout_details, up.full_name
            FROM user_profiles up
            WHERE up.wallet_balance >= $1
              AND up.payout_method IS NOT NULL
              AND up.payout_details IS NOT NULL
        `, [minPayout]);

        logger.info(`[PayoutScheduler] Found ${drivers.length} eligible drivers`);

        for (const driver of drivers) {
            try {
                // Skip if already has a pending payout
                const hasPending = await repositories.payouts.hasPendingPayout(null, driver.user_id);
                if (hasPending) continue;

                const payout = await repositories.payouts.requestPayout({
                    driverId: driver.user_id,
                    amount: parseFloat(driver.wallet_balance),
                    method: driver.payout_method,
                    details: driver.payout_details
                });

                // Deduct wallet balance
                await db.query(
                    `UPDATE user_profiles SET wallet_balance = 0, updated_at = NOW() WHERE user_id = $1`,
                    [driver.user_id]
                );
                await db.query(
                    `INSERT INTO wallet_logs (user_id, amount, transaction_type, balance_after)
                     VALUES ($1, $2, 'withdrawal', 0)`,
                    [driver.user_id, -parseFloat(driver.wallet_balance)]
                );

                // Initiate Paystack transfer immediately
                const details = driver.payout_details || {};
                const recipientCode = details.recipient_code || await paystackService.createTransferRecipient({
                    type: driver.payout_method === 'bank' ? 'nuban' : 'mobile_money',
                    name: driver.full_name || 'Driver',
                    account_number: details.account_number || details.phone,
                    bank_code: details.bank_code || details.network,
                    currency: 'GHS'
                });

                const transfer = await paystackService.initiateTransfer({
                    amount: payout.amount,
                    recipient: recipientCode,
                    reason: `Driver auto-payout #${payout.id}`
                });

                await repositories.payouts.updatePayoutStatus(payout.id, 'processing', {
                    transactionReference: transfer.reference,
                    notes: `Auto nightly payout. Ref: ${transfer.reference}`
                });

                logger.info(`[PayoutScheduler] Driver ${driver.user_id} payout initiated`, {
                    amount: payout.amount,
                    reference: transfer.reference
                });
            } catch (err) {
                logger.error(`[PayoutScheduler] Driver ${driver.user_id} payout failed:`, err.message);
                // On transfer failure the webhook will handle refund; nothing to rollback here yet
            }
        }
    } catch (err) {
        logger.error('[PayoutScheduler] Driver job error:', err.message);
    } finally {
        driverJobRunning = false;
        logger.info('[PayoutScheduler] Driver nightly payout job finished');
    }
}

async function runSellerPayouts() {
    if (sellerJobRunning) {
        logger.info('[PayoutScheduler] Seller job already running, skipping');
        return;
    }
    sellerJobRunning = true;
    logger.info('[PayoutScheduler] Seller weekly payout job started');

    try {
        const db = require('../config/postgres').getPool();

        // Fetch min_payout_amount from config
        const configRes = await db.query(
            `SELECT config_value FROM platform_fee_config WHERE config_key = 'min_payout_amount'`
        );
        const minPayout = configRes.rows[0] ? parseFloat(configRes.rows[0].config_value) : 50;

        // Find stores with eligible balance entries:
        //   - balance_logs.payout_eligible_at <= NOW()
        //   - no open return_request on that order
        const { rows: storeGroups } = await db.query(`
            SELECT
                bl.store_id,
                SUM(bl.amount) AS eligible_amount,
                s.payout_method,
                s.payout_details,
                s.store_name,
                s.current_balance
            FROM balance_logs bl
            JOIN stores s ON s.id = bl.store_id
            WHERE bl.transaction_type = 'sale'
              AND bl.payout_eligible_at IS NOT NULL
              AND bl.payout_eligible_at <= NOW()
              AND NOT EXISTS (
                  SELECT 1 FROM return_requests rr
                  WHERE rr.order_id = bl.order_id
                    AND rr.status IN ('pending', 'seller_approved', 'admin_review')
              )
              AND s.payout_method IS NOT NULL
              AND s.payout_details IS NOT NULL
            GROUP BY bl.store_id, s.payout_method, s.payout_details, s.store_name, s.current_balance
            HAVING SUM(bl.amount) >= $1
        `, [minPayout]);

        logger.info(`[PayoutScheduler] Found ${storeGroups.length} eligible sellers`);

        for (const store of storeGroups) {
            try {
                const hasPending = await repositories.payouts.hasPendingPayout(store.store_id, null);
                if (hasPending) continue;

                const amount = parseFloat(store.eligible_amount);
                const payout = await repositories.payouts.requestPayout({
                    storeId: store.store_id,
                    amount,
                    method: store.payout_method,
                    details: store.payout_details
                });

                // Deduct eligible amount from store balance
                const newBalance = Math.max(0, parseFloat(store.current_balance || 0) - amount);
                await db.query(
                    `UPDATE stores SET current_balance = $1, updated_at = NOW() WHERE id = $2`,
                    [newBalance, store.store_id]
                );
                await db.query(
                    `INSERT INTO balance_logs (store_id, amount, transaction_type, payout_id, balance_after, notes)
                     VALUES ($1, $2, 'withdrawal', $3, $4, 'Weekly auto-payout')`,
                    [store.store_id, -amount, payout.id, newBalance]
                );

                // Mark the eligible balance_log entries as consumed (set payout_eligible_at to past date so scheduler won't re-pick them)
                await db.query(`
                    UPDATE balance_logs SET payout_eligible_at = '2000-01-01'::TIMESTAMPTZ
                    WHERE store_id = $1
                      AND transaction_type = 'sale'
                      AND payout_eligible_at IS NOT NULL
                      AND payout_eligible_at <= NOW()
                `, [store.store_id]);

                // Initiate Paystack transfer
                const details = store.payout_details || {};
                const recipientCode = details.recipient_code || await paystackService.createTransferRecipient({
                    type: store.payout_method === 'bank' ? 'nuban' : 'mobile_money',
                    name: store.store_name || 'Seller',
                    account_number: details.account_number || details.phone,
                    bank_code: details.bank_code || details.network,
                    currency: 'GHS'
                });

                const transfer = await paystackService.initiateTransfer({
                    amount: payout.amount,
                    recipient: recipientCode,
                    reason: `Seller weekly auto-payout #${payout.id}`
                });

                await repositories.payouts.updatePayoutStatus(payout.id, 'processing', {
                    transactionReference: transfer.reference,
                    notes: `Weekly auto-payout. Ref: ${transfer.reference}`
                });

                logger.info(`[PayoutScheduler] Seller ${store.store_id} payout initiated`, {
                    amount: payout.amount,
                    reference: transfer.reference
                });
            } catch (err) {
                logger.error(`[PayoutScheduler] Seller ${store.store_id} payout failed:`, err.message);
            }
        }
    } catch (err) {
        logger.error('[PayoutScheduler] Seller job error:', err.message);
    } finally {
        sellerJobRunning = false;
        logger.info('[PayoutScheduler] Seller weekly payout job finished');
    }
}

function initPayoutScheduler() {
    // Driver: nightly at 02:00 AM
    cron.schedule('0 2 * * *', runDriverPayouts, { timezone: 'Africa/Accra' });

    // Seller: every Monday at 06:00 AM
    cron.schedule('0 6 * * 1', runSellerPayouts, { timezone: 'Africa/Accra' });

    logger.info('[PayoutScheduler] Payout scheduler initialized (driver: 02:00 daily, seller: 06:00 Mondays)');
}

module.exports = { initPayoutScheduler, runDriverPayouts, runSellerPayouts };
