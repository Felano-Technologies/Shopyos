// routes/disclaimerRoutes.js
const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getDisclaimer,
  acknowledgeDisclaimer,
  checkAcknowledgement,
  updateDisclaimer,
  getAcknowledgementsAudit,
} = require('../controllers/disclaimerController');

// Registered user endpoints (cancellation notices, bargain rules, etc.)
router.get('/check', protect, checkAcknowledgement);
router.get('/:type', protect, getDisclaimer);
router.post('/acknowledge', protect, acknowledgeDisclaimer);

// Administrator endpoints (disclaimer management and audits)
router.put('/:type', protect, admin, updateDisclaimer);
router.get('/admin/audit', protect, admin, getAcknowledgementsAudit);

module.exports = router;
