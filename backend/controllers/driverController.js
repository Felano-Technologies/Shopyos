const repositories = require('../db/repositories');
const { uploadFileToCloudinary } = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');
const notificationService = require('../services/notificationService');

/**
 * Submit driver verification details
 * @route   POST /api/deliveries/verify
 * @access  Private (Driver)
 */
const submitVerification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { vehicleType, plateNumber, licenseNumber } = req.body;
    
    const files = req.files || {};
    const updates = {
        vehicleType,
        plateNumber,
        licenseNumber
    };

    // Upload files if present
    if (files.idCard) {
      const result = await uploadFileToCloudinary(files.idCard[0], 'shopyos/driver-docs/ids');
      updates.national_id_url = result.url;
    }
    
    if (files.licenseFront) {
      const result = await uploadFileToCloudinary(files.licenseFront[0], 'shopyos/driver-docs/licenses');
      updates.license_image_url = result.url;
    }
    
    if (files.licenseBack) {
       await uploadFileToCloudinary(files.licenseBack[0], 'shopyos/driver-docs/licenses');
    }

    if (files.insurance) {
      const result = await uploadFileToCloudinary(files.insurance[0], 'shopyos/driver-docs/insurance');
      updates.insurance_doc_url = result.url;
    }

    if (files.profilePhoto) {
      // Update user profile avatar
      const result = await uploadFileToCloudinary(files.profilePhoto[0], 'shopyos/driver-docs/profiles');
      await repositories.userProfiles.updateByUserId(userId, { avatar_url: result.url });
    }

    const profile = await repositories.drivers.upsertProfile(userId, updates);

    // Get user full name for notification
    const profileData = await repositories.userProfiles.findByUserId(userId);
    const driverName = profileData?.full_name || req.user.email;

    // Notify admins
    await notificationService.notifyAdminsVerificationRequest(profile.id, 'driver', driverName);
    
    res.status(200).json({
      success: true,
      message: 'Verification documents submitted successfully',
      profile
    });
  } catch (error) {
    logger.error('Error submitting driver verification:', error);
    next(error);
  }
};

/**
 * Get driver profile/verification status
 * @route   GET /api/deliveries/driver/profile
 * @access  Private (Driver)
 */
const getDriverProfile = async (req, res, next) => {
    try {
        const profile = await repositories.drivers.findByUserId(req.user.id);
        res.status(200).json({
            success: true,
            profile
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
  submitVerification,
  getDriverProfile
};
