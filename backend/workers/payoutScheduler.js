// workers/payoutScheduler.js
// Payouts now fire instantly at delivery confirmation (see payoutController's
// attemptInstantPayout, called from delivery/order/admin controllers). These
// two jobs are just a safety-net sweep for stragglers whose balance is
// sitting unpaid — most commonly because they had no payout method on file
// at delivery time and added one since.
//   Driver job: nightly at 02:00 AM
//   Seller job: Mondays at 06:00 AM

const cron = require('node-cron');
const { logger } = require('../config/logger');
const { acquireLock } = require('../config/redis');
const repositories = require('../db/repositories');
const { attemptInstantPayout } = require('../controllers/payoutController');

let driverJobRunning = false;
let sellerJobRunning = false;

async function runDriverPayouts() {
    if (driverJobRunning) {
        logger.info('[PayoutScheduler] Driver job already running, skipping');
        return;
    }
    driverJobRunning = true;
    logger.info('[PayoutScheduler] Driver nightly payout sweep started');

    try {
        const db = require('../config/postgres').getPool();

        const configRes = await db.query(
            `SELECT config_value FROM platform_fee_config WHERE config_key = 'min_driver_payout'`
        );
        const minPayout = configRes.rows[0] ? parseFloat(configRes.rows[0].config_value) : 10;

        const { rows: drivers } = await db.query(`
            SELECT up.user_id, up.wallet_balance
            FROM user_profiles up
            WHERE up.wallet_balance >= $1
              AND up.payout_method IS NOT NULL
              AND up.payout_details IS NOT NULL
        `, [minPayout]);

        logger.info(`[PayoutScheduler] Found ${drivers.length} drivers with a sitting balance`);

        for (const driver of drivers) {
            const hasPending = await repositories.payouts.hasPendingPayout(null, driver.user_id);
            if (hasPending) continue;

            const result = await attemptInstantPayout({
                type: 'driver',
                driverId: driver.user_id,
                amount: driver.wallet_balance,
                sourceNote: 'Scheduled safety-net payout'
            });
            if (result.attempted && !result.failed) {
                logger.info(`[PayoutScheduler] Driver ${driver.user_id} sweep payout initiated`, { amount: driver.wallet_balance });
            }
        }
    } catch (err) {
        logger.error('[PayoutScheduler] Driver job error:', err.message);
    } finally {
        driverJobRunning = false;
        logger.info('[PayoutScheduler] Driver nightly payout sweep finished');
    }
}

async function runSellerPayouts() {
    if (sellerJobRunning) {
        logger.info('[PayoutScheduler] Seller job already running, skipping');
        return;
    }
    sellerJobRunning = true;
    logger.info('[PayoutScheduler] Seller weekly payout sweep started');

    try {
        const db = require('../config/postgres').getPool();

        const configRes = await db.query(
            `SELECT config_value FROM platform_fee_config WHERE config_key = 'min_payout_amount'`
        );
        const minPayout = configRes.rows[0] ? parseFloat(configRes.rows[0].config_value) : 50;

        // No more return-window gate — payouts are instant with no hold window,
        // so any sitting balance (from a missing payout method at delivery time) is eligible.
        const { rows: stores } = await db.query(`
            SELECT id, current_balance
            FROM stores
            WHERE current_balance >= $1
              AND payout_method IS NOT NULL
              AND payout_details IS NOT NULL
        `, [minPayout]);

        logger.info(`[PayoutScheduler] Found ${stores.length} sellers with a sitting balance`);

        for (const store of stores) {
            const hasPending = await repositories.payouts.hasPendingPayout(store.id, null);
            if (hasPending) continue;

            const result = await attemptInstantPayout({
                type: 'seller',
                storeId: store.id,
                amount: store.current_balance,
                sourceNote: 'Scheduled safety-net payout'
            });
            if (result.attempted && !result.failed) {
                logger.info(`[PayoutScheduler] Seller ${store.id} sweep payout initiated`, { amount: store.current_balance });
            }
        }
    } catch (err) {
        logger.error('[PayoutScheduler] Seller job error:', err.message);
    } finally {
        sellerJobRunning = false;
        logger.info('[PayoutScheduler] Seller weekly payout sweep finished');
    }
}

function initPayoutScheduler() {
    // Cross-instance locks: overlapping containers (rolling deploys) must not
    // both run a payout batch — money moves in these jobs.
    const day = () => new Date().toISOString().slice(0, 10);

    // Driver: nightly at 02:00 AM
    cron.schedule('0 2 * * *', async () => {
        if (!await acquireLock(`lock:driver_payouts:${day()}`, 3600)) return;
        await runDriverPayouts();
    }, { timezone: 'Africa/Accra' });

    // Seller: every Monday at 06:00 AM
    cron.schedule('0 6 * * 1', async () => {
        if (!await acquireLock(`lock:seller_payouts:${day()}`, 3600)) return;
        await runSellerPayouts();
    }, { timezone: 'Africa/Accra' });

    logger.info('[PayoutScheduler] Payout scheduler initialized (driver: 02:00 daily, seller: 06:00 Mondays)');
}

module.exports = { initPayoutScheduler, runDriverPayouts, runSellerPayouts };
