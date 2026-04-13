const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { cacheMiddleware, storeCacheKey, hashParams } = require('../middleware/cache');
const {
  createBusiness, getMyBusinesses, getBusinessById,
  updateBusiness, deleteBusiness, uploadLogo,
  uploadBanner, getBusinessDashboard, getBusinessAnalytics,
  getAllBusinesses, followBusiness, unfollowBusiness,
  getBusinessReviews
} = require('../controllers/businessController');

// Define cache keys for business routes
const dashboardCacheKey = (id) => `shopyos:stores:dashboard:${id}`;
const analyticsCacheKey = (id, params) => `shopyos:stores:analytics:${id}:${hashParams(params)}`;

const createUploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'logo_url', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
  { name: 'banner_url', maxCount: 1 },
  { name: 'businessCert', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 },
  { name: 'proofOfBank', maxCount: 1 }
]);

router.post('/create', protect, createUploadFields, createBusiness);

// Usually skip caching for user-specific views unless they are heavily hit, but we'll leave this uncached since it relies on req.user.id
router.get('/my-businesses', protect, getMyBusinesses);

router.get('/all', protect, cacheMiddleware((req) => storeCacheKey.all(req.query), 300), getAllBusinesses);
router.get('/:id', protect, cacheMiddleware((req) => storeCacheKey.detail(req.params.id), 300), getBusinessById);

router.put('/update/:id', protect, createUploadFields, updateBusiness);
router.delete('/:id', protect, deleteBusiness);

router.post('/:id/upload-logo', protect, upload.single('logo'), uploadLogo);
router.post('/:id/upload-banner', protect, upload.single('banner'), uploadBanner);

// Dashboard/Analytics routes have intensive DB queries. Cache for 60 seconds (near real-time)
router.get('/dashboard/:id', protect, cacheMiddleware((req) => dashboardCacheKey(req.params.id), 60), getBusinessDashboard);
router.get('/analytics/:id', protect, cacheMiddleware((req) => analyticsCacheKey(req.params.id, req.query), 60), getBusinessAnalytics);
router.get('/:id/reviews', protect, getBusinessReviews);

router.post('/:id/follow', protect, followBusiness);
router.delete('/:id/follow', protect, unfollowBusiness);

module.exports = router;