// utils/uploadHelpers.js
// Helper functions for file uploads to Cloudinary

const { uploadImage, uploadMultipleImages, deleteImage } = require('../config/cloudinary');
const { Readable } = require('stream');
const { logger } = require('../config/logger');

/**
 * Convert buffer to base64 data URI
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} mimetype - File MIME type
 * @returns {string} Base64 data URI
 */
const bufferToDataURI = (buffer, mimetype) => {
  const base64 = buffer.toString('base64');
  return `data:${mimetype};base64,${base64}`;
};

/**
 * Upload file from multer to Cloudinary
 * @param {object} file - Multer file object
 * @param {string} folder - Cloudinary folder
 * @returns {Promise<object>} Upload result
 */
const uploadFileToCloudinary = async (file, folder = 'shopyos') => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    // Convert buffer to data URI
    const dataURI = bufferToDataURI(file.buffer, file.mimetype);

    // Upload to Cloudinary
    const result = await uploadImage(dataURI, folder);

    return {
      url: result.url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      size: file.size
    };
  } catch (error) {
    logger.error('Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload multiple files from multer to Cloudinary
 * @param {Array<object>} files - Array of multer file objects
 * @param {string} folder - Cloudinary folder
 * @returns {Promise<Array<object>>} Array of upload results
 */
const uploadMultipleFilesToCloudinary = async (files, folder = 'shopyos') => {
  if (!files || files.length === 0) {
    throw new Error('No files provided');
  }

  try {
    const uploadPromises = files.map(file => uploadFileToCloudinary(file, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    logger.error('Multiple upload error:', error);
    throw new Error(`Failed to upload files: ${error.message}`);
  }
};

/**
 * Delete old image and upload new one
 * @param {string} oldPublicId - Old Cloudinary public ID to delete
 * @param {object} newFile - New multer file object
 * @param {string} folder - Cloudinary folder
 * @returns {Promise<object>} Upload result
 */
const replaceImage = async (oldPublicId, newFile, folder = 'shopyos') => {
  try {
    // Upload new image first
    const uploadResult = await uploadFileToCloudinary(newFile, folder);

    // Delete old image if upload successful
    if (oldPublicId) {
      await deleteImage(oldPublicId).catch(err =>
        logger.warn('Failed to delete old image:', err.message)
      );
    }

    return uploadResult;
  } catch (error) {
    logger.error('Replace image error:', error);
    throw new Error(`Failed to replace image: ${error.message}`);
  }
};

/**
 * Validate image file
 * @param {object} file - Multer file object
 * @param {number} maxSize - Max file size in bytes (default 5MB)
 * @returns {object} Validation result
 */
const validateImage = (file, maxSize = 5 * 1024 * 1024) => {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
  } else {
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID
 */
const extractPublicId = (url) => {
  if (!url) return null;

  try {
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return matches ? matches[1] : null;
  } catch (error) {
    logger.error('Error extracting public ID:', error);
    return null;
  }
};

module.exports = {
  bufferToDataURI,
  uploadFileToCloudinary,
  uploadMultipleFilesToCloudinary,
  replaceImage,
  validateImage,
  extractPublicId,
  deleteImage
};
