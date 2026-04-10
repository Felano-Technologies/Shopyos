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
 * @route   POST /api/upload/single
 * @desc    Upload single image
 * @access  Private
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
 * @route   POST /api/upload/multiple
 * @desc    Upload multiple images
 * @access  Private
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
 * @route   POST /api/upload/avatar
 * @desc    Upload user avatar
 * @access  Private
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
 * @route   POST /api/upload/product-images
 * @desc    Upload product images
 * @access  Private (Seller only)
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
 * @route   POST /api/upload/store-logo
 * @desc    Upload store logo
 * @access  Private (Seller only)
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
