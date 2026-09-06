// routes/payoutRoutes.js
const express = require('express');
const router = express.Router();
const {
    requestPayout,
    getPayoutHistory,
    getSellerTransactions,
    getSellerLockedBalance,
    requestDriverPayout,
    getDriverPayoutHistory,
    requestHubPayout,
    getHubPayoutHistory,
    getAdminPayouts,
    getAdminPayoutSummary,
    processPayout,
    bulkProcessPayouts
} = require('../controllers/payoutController');
const { protect, seller, admin, hasAnyRole } = require('../middleware/authMiddleware');
const { validateRequestPayout } = require('../middleware/validators');
const requireDisclaimer = require('../middleware/requireDisclaimer');

router.use(protect);

// ── Seller ────────────────────────────────────────────────────────────────
router.post('/request', seller, requireDisclaimer('payout_terms'), validateRequestPayout, requestPayout);
router.get('/history/:storeId', seller, getPayoutHistory);
router.get('/transactions/:storeId', seller, getSellerTransactions);
router.get('/locked/:storeId', seller, getSellerLockedBalance);

// ── Driver ────────────────────────────────────────────────────────────────
router.post('/driver-request', requireDisclaimer('driver_earnings'), requestDriverPayout);
router.get('/driver-history', getDriverPayoutHistory);

// ── Hub ───────────────────────────────────────────────────────────────────
router.post('/hub/request', hasAnyRole('parcel_partner'), requireDisclaimer('parcel_hub_earnings'), requestHubPayout);
router.get('/hub/history/:hubId', hasAnyRole('parcel_partner'), getHubPayoutHistory);

// ── Admin ─────────────────────────────────────────────────────────────────
router.get('/admin/all', admin, getAdminPayouts);
router.get('/admin/summary', admin, getAdminPayoutSummary);
router.post('/admin/bulk-process', admin, bulkProcessPayouts);
router.put('/:payoutId/process', admin, processPayout);

module.exports = router;
