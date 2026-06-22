// routes/parcelPartnerRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');

const {
  getHubs,
  getDashboardStats,
  getHubParcels,
  checkInParcel,
  dispatchParcel,
  arriveParcel
} = require('../controllers/parcelPartnerController');

const {
  requestLastMile,
  getTransitInfo
} = require('../controllers/interRegionalController');

// Helper role check middleware
const requireRole = (role) => (req, res, next) => {
  if (!req.user.roles?.includes(role) && !req.user.roles?.includes('admin')) {
    return res.status(403).json({ success: false, error: `${role} role required` });
  }
  next();
};

// All routes require authentication
router.use(protect);

// Partner Portal routes
router.get('/hubs', requireRole('parcel_partner'), getHubs);
router.get('/dashboard', requireRole('parcel_partner'), getDashboardStats);
router.get('/parcels', requireRole('parcel_partner'), getHubParcels);
router.put('/parcels/:orderId/check-in', requireRole('parcel_partner'), checkInParcel);
router.put('/parcels/:orderId/dispatch', requireRole('parcel_partner'), dispatchParcel);
router.put('/parcels/:orderId/arrived', requireRole('parcel_partner'), arriveParcel);

// Buyer / Public Courier routes
router.post('/orders/:orderId/request-last-mile', requireDisclaimer('inter_regional_terms'), requestLastMile);
router.get('/orders/:orderId/transit-info', getTransitInfo);

module.exports = router;
