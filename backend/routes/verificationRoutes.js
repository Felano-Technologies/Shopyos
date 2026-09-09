// routes/verificationRoutes.js
// Applicant-facing endpoints for the unified KYC/verification system (Phase 1).
// Admin review endpoints live in adminRoutes.js instead, gated by the
// verification admin permission tiers.

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getOrCreateApplication,
  saveStep,
  recordConsent,
  uploadDocument,
  getDocumentSignedUrl,
  getLivenessFrameSignedUrl,
  submitLivenessAttempt,
  submitApplication,
  requestShopLocationChange,
  requestDriverVehicleChange,
} = require('../controllers/verificationController');
const { envInt } = require('../config/envConfig');

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: envInt('MAX_VERIFICATION_DOCUMENT_SIZE_BYTES', 15 * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\//.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (!allowed) return cb(new Error('Only images and PDFs are allowed for verification documents'));
    cb(null, true);
  },
});

router.use(protect);

router.get('/documents/:id/signed-url', getDocumentSignedUrl);
router.get('/liveness/:attemptId/frames/:label/signed-url', getLivenessFrameSignedUrl);

router.get('/:role', getOrCreateApplication);
router.post('/:applicationId/consent', recordConsent);
router.patch('/:applicationId/steps/:stepKey', saveStep);
router.post('/:applicationId/documents', documentUpload.single('document'), uploadDocument);
// Up to 6 frames per attempt: 1 baseline + up to 5 challenge frames (pickChallenges() caps at 3).
router.post('/:applicationId/liveness', documentUpload.array('frames', 6), submitLivenessAttempt);
router.post('/:applicationId/submit', submitApplication);
router.post('/shop-location-change', requestShopLocationChange);
router.post('/vehicle-change', requestDriverVehicleChange);

module.exports = router;
