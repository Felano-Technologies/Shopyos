// routes/payoutRoutes.js
const express = require('express');
const router = express.Router();
const {
    requestPayout,
    getPayoutHistory,
    getSellerLockedBalance,
    requestDriverPayout,
    getDriverPayoutHistory,
    getAdminPayouts,
    getAdminPayoutSummary,
    processPayout,
    bulkProcessPayouts
} = require('../controllers/payoutController');
const { protect, seller, admin } = require('../middleware/authMiddleware');
const { validateRequestPayout } = require('../middleware/validators');
const requireDisclaimer = require('../middleware/requireDisclaimer');

router.use(protect);

// ── Seller ────────────────────────────────────────────────────────────────
router.post('/request', seller, requireDisclaimer('payout_terms'), validateRequestPayout, requestPayout);
router.get('/history/:storeId', seller, getPayoutHistory);
router.get('/locked/:storeId', seller, getSellerLockedBalance);

// ── Driver ────────────────────────────────────────────────────────────────
router.post('/driver-request', requestDriverPayout);
router.get('/driver-history', getDriverPayoutHistory);

// ── Admin ─────────────────────────────────────────────────────────────────
router.get('/admin/all', admin, getAdminPayouts);
router.get('/admin/summary', admin, getAdminPayoutSummary);
router.post('/admin/bulk-process', admin, bulkProcessPayouts);
router.put('/:payoutId/process', admin, processPayout);

module.exports = router;
