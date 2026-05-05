// routes/userActionRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const userActionController = require('../controllers/userActionController');
const { body, param } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

router.use(protect);

router.post('/block',
    [
        body('blockedId').isUUID().withMessage('Valid Blocked User ID is required')
    ],
    validateRequest,
    userActionController.blockUser
);

router.delete('/block/:blockedId',
    [
        param('blockedId').isUUID().withMessage('Valid Blocked User ID is required')
    ],
    validateRequest,
    userActionController.unblockUser
);

router.get('/blocks', userActionController.getBlockedUsers);

router.post('/report',
    [
        body('entityType').isIn(['user', 'store']).withMessage('Entity type must be user or store'),
        body('entityId').isUUID().withMessage('Valid Entity ID is required'),
        body('reason').notEmpty().withMessage('Reason is required')
    ],
    validateRequest,
    userActionController.reportEntity
);

module.exports = router;
