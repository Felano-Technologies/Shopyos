// routes/uploadRoutes.js
// Example routes for file uploads using Cloudinary

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const {
  uploadFileToCloudinary,
  uploadMultipleFilesToCloudinary,
  validateImage
} = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');

/**
 * @swagger
 * /api/v1/upload/single:
 *   post:
 *     summary: Upload a single image
 *     tags: [Upload]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *         required: false
 *         description: Cloudinary folder to upload into (defaults to shopyos/general)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The image file to upload
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Image uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *       400:
 *         description: No file uploaded or validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: No file uploaded
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Not authorized
 */
router.post('/single', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate image
    const validation = validateImage(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Get folder from query param or use default
    const folder = req.query.folder || 'shopyos/general';

    // Upload to Cloudinary
    const result = await uploadFileToCloudinary(req.file, folder);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: result
    });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload image'
    });
  }
});

/**
 * @swagger
 * /api/v1/upload/multiple:
 *   post:
 *     summary: Upload multiple images (up to 10)
 *     tags: [Upload]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *         required: false
 *         description: Cloudinary folder to upload into (defaults to shopyos/general)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - images
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files to upload (maximum 10)
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 3 images uploaded successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       url:
 *                         type: string
 *                         example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *       400:
 *         description: No files uploaded or validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: No files uploaded
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Not authorized
 */
router.post('/multiple', protect, upload.multiple('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Validate all images
    const validationErrors = [];
    req.files.forEach((file, index) => {
      const validation = validateImage(file);
      if (!validation.valid) {
        validationErrors.push({
          file: index + 1,
          errors: validation.errors
        });
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    // Get folder from query param or use default
    const folder = req.query.folder || 'shopyos/general';

    // Upload all to Cloudinary
    const results = await uploadMultipleFilesToCloudinary(req.files, folder);

    res.status(200).json({
      success: true,
      message: `${results.length} images uploaded successfully`,
      data: results
    });

  } catch (error) {
    logger.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload images'
    });
  }
});

/**
 * @swagger
 * /api/v1/upload/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file (max 2 MB)
 *     responses:
 *       200:
 *         description: Avatar uploaded and user profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Avatar uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: https://res.cloudinary.com/demo/image/upload/avatars/sample.jpg
 *       400:
 *         description: No avatar file uploaded or validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: No avatar file uploaded
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Not authorized
 */
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No avatar file uploaded'
      });
    }

    // Validate image
    const validation = validateImage(req.file, 2 * 1024 * 1024); // 2MB max for avatars
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Upload to Cloudinary in avatars folder
    const result = await uploadFileToCloudinary(req.file, 'shopyos/avatars');

    // Update user profile with avatar URL
    const repositories = require('../db/repositories');
    await repositories.userProfiles.updateByUserId(req.user.id, {
      avatar_url: result.url
    });

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: result
    });

  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload avatar'
    });
  }
});

/**
 * @swagger
 * /api/v1/upload/product-images:
 *   post:
 *     summary: Upload product images (up to 5)
 *     tags: [Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - images
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Product image files (maximum 5)
 *     responses:
 *       200:
 *         description: Product images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 3 product images uploaded successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       url:
 *                         type: string
 *                         example: https://res.cloudinary.com/demo/image/upload/products/sample.jpg
 *       400:
 *         description: No product images uploaded or maximum of 5 exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Maximum 5 images allowed per product
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Not authorized
 */
router.post('/product-images', protect, upload.multiple('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No product images uploaded'
      });
    }

    // Limit to 5 images per product
    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 images allowed per product'
      });
    }

    // Upload to Cloudinary in products folder
    const results = await uploadMultipleFilesToCloudinary(req.files, 'shopyos/products');

    res.status(200).json({
      success: true,
      message: `${results.length} product images uploaded successfully`,
      data: results
    });

  } catch (error) {
    logger.error('Product images upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload product images'
    });
  }
});

/**
 * @swagger
 * /api/v1/upload/store-logo:
 *   post:
 *     summary: Upload store logo
 *     tags: [Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - logo
 *             properties:
 *               logo:
 *                 type: string
 *                 format: binary
 *                 description: Store logo image file (max 3 MB)
 *     responses:
 *       200:
 *         description: Store logo uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Store logo uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       example: https://res.cloudinary.com/demo/image/upload/store-logos/sample.jpg
 *       400:
 *         description: No logo file uploaded or validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: No logo file uploaded
 *       401:
 *         description: Unauthorized — missing or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Not authorized
 */
router.post('/store-logo', protect, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No logo file uploaded'
      });
    }

    // Validate image
    const validation = validateImage(req.file, 3 * 1024 * 1024); // 3MB max for logos
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Upload to Cloudinary in store-logos folder
    const result = await uploadFileToCloudinary(req.file, 'shopyos/store-logos');

    res.status(200).json({
      success: true,
      message: 'Store logo uploaded successfully',
      data: result
    });

  } catch (error) {
    logger.error('Store logo upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload store logo'
    });
  }
});

module.exports = router;
