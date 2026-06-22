const express = require('express');
const router = express.Router();
const snapController = require('../controllers/snapController');
const { protect, optionalAuth, hasAnyRole } = require('../middleware/authMiddleware');
const { requireStore } = require('../middleware/businessMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');

/**
 * @swagger
 * /api/v1/snaps/feed:
 *   get:
 *     summary: Get public snap feed
 *     tags: [Snaps]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of snaps per page
 *     responses:
 *       200:
 *         description: Paginated list of snaps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 */
// Public route for viewing snap feed
router.get('/feed', snapController.getSnapFeed);

/**
 * @swagger
 * /api/v1/snaps/{id}/view:
 *   post:
 *     summary: Increment view count for a snap
 *     tags: [Snaps]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Snap ID
 *     responses:
 *       200:
 *         description: View recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Snap not found
 */
// Public route to increment view count (with optional auth for unique tracking)
router.post('/:id/view', optionalAuth, snapController.viewSnap);

// Protected routes for sellers
router.use(protect);
router.use(hasAnyRole(['seller']));
router.use(requireStore);

/**
 * @swagger
 * /api/v1/snaps/my-snaps:
 *   get:
 *     summary: Get snaps created by the authenticated seller
 *     tags: [Snaps]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of snaps belonging to the authenticated seller
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role or store required
 */
router.get('/my-snaps', snapController.getMySnaps);

/**
 * @swagger
 * /api/v1/snaps:
 *   post:
 *     summary: Create a new snap
 *     tags: [Snaps]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mediaUrl
 *             properties:
 *               mediaUrl:
 *                 type: string
 *                 description: URL of the snap media (image or video)
 *               caption:
 *                 type: string
 *                 description: Optional caption for the snap
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of product IDs to associate with the snap
 *               duration:
 *                 type: integer
 *                 description: Display duration of the snap in seconds
 *     responses:
 *       200:
 *         description: Snap created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role or store required
 */
router.post('/', requireDisclaimer('content_terms'), auditLog('create_snap', 'snap'), snapController.createSnap);

/**
 * @swagger
 * /api/v1/snaps/{id}/repost:
 *   post:
 *     summary: Repost an existing snap
 *     tags: [Snaps]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the snap to repost
 *     responses:
 *       200:
 *         description: Snap reposted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role or store required
 *       404:
 *         description: Snap not found
 */
router.post('/:id/repost', auditLog('repost_snap', 'snap'), snapController.repostSnap);

/**
 * @swagger
 * /api/v1/snaps/{id}:
 *   delete:
 *     summary: Delete a snap
 *     tags: [Snaps]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the snap to delete
 *     responses:
 *       200:
 *         description: Snap deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role or store required
 *       404:
 *         description: Snap not found
 */
router.delete('/:id', auditLog('delete_snap', 'snap'), snapController.deleteSnap);

module.exports = router;
