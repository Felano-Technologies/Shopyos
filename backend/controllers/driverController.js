const repositories = require('../db/repositories');
const { uploadFileToCloudinary } = require('../utils/uploadHelpers');
const { logger } = require('../config/logger');
const ApiResponse = require('../utils/apiResponse');
const notificationService = require('../services/notificationService');
const rabbitMQService = require('../services/rabbitmq');

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

    const user = await repositories.users.findById(userId);
    if (user?.email) {
      rabbitMQService.publishMessage('email', {
        eventType: 'DRIVER_VERIFICATION_SUBMITTED',
        userId,
        role: 'driver',
        email: user.email,
        referenceId: profile.id,
        templateData: {
          driverName,
          audience: 'driver'
        }
      });
    }

    const admins = await repositories.users.getAdmins();
    (admins || []).forEach((admin) => {
      if (admin?.email) {
        rabbitMQService.publishMessage('email', {
          eventType: 'DRIVER_VERIFICATION_SUBMITTED',
          userId: admin.id,
          role: 'admin',
          email: admin.email,
          referenceId: profile.id,
          templateData: {
            driverName,
            audience: 'admin'
          }
        });
      }
    });
    
    ApiResponse.withEntity(res, 'profile', profile, 'Verification documents submitted successfully');
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
// Same reasoning as businessController.js's _resolveSellerVerificationStatus:
// driver_profiles.is_verified is a plain boolean with no 'rejected'/'pending'
// distinction (useDriverGuard.ts's `driver.verification_status` was always
// undefined as a result) — derive a real verification_status here from the
// new verification_applications table, falling back to the boolean when no
// application exists yet or on any lookup error.
const DRIVER_STATUS_DISPLAY_MAP = { approved: 'verified', rejected: 'rejected', suspended: 'rejected' };
const _resolveDriverVerificationStatus = async (profile) => {
  try {
    const application = await repositories.verification.getApplicationByEntityId(profile.id, 'driver');
    if (!application) return { verification_status: profile.is_verified ? 'verified' : 'pending' };
    return { verification_status: DRIVER_STATUS_DISPLAY_MAP[application.status] || 'pending', rejection_reason: application.rejection_reason || profile.rejection_reason || null };
  } catch (error) {
    logger.warn('Failed to resolve driver verification status from verification_applications, falling back to is_verified', {
      error: error.message, driverProfileId: profile.id,
    });
    return { verification_status: profile.is_verified ? 'verified' : 'pending' };
  }
};

const getDriverProfile = async (req, res, next) => {
    try {
        const profile = await repositories.drivers.findByUserId(req.user.id);
        if (!profile) return ApiResponse.withEntity(res, 'profile', profile);

        ApiResponse.withEntity(res, 'profile', { ...profile, ...(await _resolveDriverVerificationStatus(profile)) });

    } catch (error) {
        next(error);
    }
};

/**
 * Update driver availability (online/offline)
 * @route   PUT /api/deliveries/driver/availability
 * @access  Private (Driver)
 */
const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    const userId = req.user.id;

    const profile = await repositories.drivers.updateAvailability(userId, isAvailable);

    ApiResponse.withEntity(res, 'profile', profile, `Driver is now ${isAvailable ? 'online' : 'offline'}`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitVerification,
  getDriverProfile,
  updateAvailability
};
