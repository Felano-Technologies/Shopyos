// routes/disclaimerRoutes.js
const express = require('express');
const router = express.Router();
const { protect, optionalAuth, admin } = require('../middleware/authMiddleware');
const {
  getDisclaimer,
  acknowledgeDisclaimer,
  checkAcknowledgement,
  updateDisclaimer,
  getAcknowledgementsAudit,
} = require('../controllers/disclaimerController');

// Reading a disclaimer is public — the register screen shows Terms of Service
// and Privacy Policy before an account exists. Acknowledging still needs auth.
router.get('/check', protect, checkAcknowledgement);
router.get('/:type', getDisclaimer);
// optionalAuth: the shipped app's register screen calls acknowledge before an
// account exists — the controller answers those without persisting (consent is
// recorded server-side at registration). Authenticated calls persist as before.
router.post('/acknowledge', optionalAuth, acknowledgeDisclaimer);

// Administrator endpoints (disclaimer management and audits)
router.put('/:type', protect, admin, updateDisclaimer);
router.get('/admin/audit', protect, admin, getAcknowledgementsAudit);

module.exports = router;
