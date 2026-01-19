// config/cloudinary.js
// Cloudinary configuration and utilities for image uploads

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload image to Cloudinary
 * @param {string} imagePath - Local file path or base64 string
 * @param {string} folder - Cloudinary folder name
 * @param {object} options - Additional upload options
 * @returns {Promise<object>} Upload result with url and public_id
 */
const uploadImage = async (imagePath, folder = 'shopyos', options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder,
      resource_type: 'auto',
      ...options
    });

    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array<string>} imagePaths - Array of file paths or base64 strings
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<Array<object>>} Array of upload results
 */
const uploadMultipleImages = async (imagePaths, folder = 'shopyos') => {
  try {
    const uploadPromises = imagePaths.map(path => uploadImage(path, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple images upload error:', error);
    throw new Error(`Multiple images upload failed: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param {Array<string>} publicIds - Array of Cloudinary public IDs
 * @returns {Promise<Array<object>>} Array of deletion results
 */
const deleteMultipleImages = async (publicIds) => {
  try {
    const deletePromises = publicIds.map(id => deleteImage(id));
    return await Promise.all(deletePromises);
  } catch (error) {
    console.error('Multiple images delete error:', error);
    throw new Error(`Multiple images deletion failed: ${error.message}`);
  }
};

/**
 * Get optimized image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {object} transformations - Cloudinary transformation options
 * @returns {string} Transformed image URL
 */
const getOptimizedUrl = (publicId, transformations = {}) => {
  return cloudinary.url(publicId, {
    fetch_format: 'auto',
    quality: 'auto',
    ...transformations
  });
};

/**
 * Generate thumbnail URL
 * @param {string} publicId - Cloudinary public ID
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {string} Thumbnail URL
 */
const getThumbnailUrl = (publicId, width = 200, height = 200) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'auto',
    fetch_format: 'auto',
    quality: 'auto'
  });
};

/**
 * Test Cloudinary connection
 * @returns {Promise<boolean>} True if connected
 */
const testConnection = async () => {
  try {
    await cloudinary.api.ping();
    console.log('✅ Cloudinary connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
    return false;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  deleteMultipleImages,
  getOptimizedUrl,
  getThumbnailUrl,
  testConnection
};
