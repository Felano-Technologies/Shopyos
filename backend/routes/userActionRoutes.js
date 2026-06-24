// routes/userActionRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const userActionController = require('../controllers/userActionController');
const { body, param } = require('express-validator');
const { validateRequest } = require('../middleware/validateRequest');

router.use(protect);

/**
 * @swagger
 * /api/v1/user-actions/block:
 *   post:
 *     summary: Block a user
 *     description: Blocks another user so they can no longer interact with the authenticated user.
 *     tags: [User Actions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the user to block
 *                 example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
 *     responses:
 *       200:
 *         description: User blocked successfully
 *       400:
 *         description: Validation error — invalid userId
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: User to block not found
 */
router.post('/block',
    [
        body('blockedId').isUUID().withMessage('Valid Blocked User ID is required')
    ],
    validateRequest,
    userActionController.blockUser
);

/**
 * @swagger
 * /api/v1/user-actions/block/{blockedId}:
 *   delete:
 *     summary: Unblock a user
 *     description: Removes a block on a previously blocked user.
 *     tags: [User Actions]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blockedId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to unblock
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       400:
 *         description: Validation error — invalid blockedId
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Block record not found
 */
router.delete('/block/:blockedId',
    [
        param('blockedId').isUUID().withMessage('Valid Blocked User ID is required')
    ],
    validateRequest,
    userActionController.unblockUser
);

/**
 * @swagger
 * /api/v1/user-actions/blocks:
 *   get:
 *     summary: Get list of blocked users
 *     description: Returns all users the authenticated user has blocked.
 *     tags: [User Actions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked users list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blockedUsers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       username:
 *                         type: string
 *                       blockedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/blocks', userActionController.getBlockedUsers);

/**
 * @swagger
 * /api/v1/user-actions/report:
 *   post:
 *     summary: Report a user or store
 *     description: Submits a report against a user or store for review by platform administrators.
 *     tags: [User Actions]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entityType
 *               - entityId
 *               - reason
 *             properties:
 *               entityType:
 *                 type: string
 *                 enum: [user, store]
 *                 description: The type of entity being reported
 *                 example: user
 *               entityId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the entity being reported
 *                 example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
 *               reason:
 *                 type: string
 *                 description: The reason for the report
 *                 example: Spam
 *               description:
 *                 type: string
 *                 description: Optional additional details about the report
 *                 example: This user sent me unsolicited messages repeatedly.
 *     responses:
 *       200:
 *         description: Report submitted successfully
 *       400:
 *         description: Validation error — invalid entityType, entityId, or missing reason
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Reported entity not found
 */
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
