// routes/callRoutes.js
// In-app calling — buyer/seller/driver initiate/accept/reject/end, order-scoped.

const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { envInt } = require('../config/envConfig');
const {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getMyCalls,
  uploadCallRecording,
} = require('../controllers/callController');

// A 30s voice-only recording is small — a generous cap still keeps this
// well clear of the app's general upload limit.
const recordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: envInt('MAX_CALL_RECORDING_SIZE_BYTES', 10 * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    const allowed = /^audio\//.test(file.mimetype) || /\.(m4a|aac|mp3|wav|3gp|amr|ogg)$/i.test(file.originalname || '');
    if (!allowed) return cb(new Error('Only audio recordings are allowed'));
    cb(null, true);
  },
});

router.use(protect);

router.post('/', initiateCall);
router.get('/', getMyCalls);
router.post('/:id/accept', acceptCall);
router.post('/:id/reject', rejectCall);
router.post('/:id/end', endCall);
router.post('/:id/recording', recordingUpload.single('recording'), uploadCallRecording);

module.exports = router;
