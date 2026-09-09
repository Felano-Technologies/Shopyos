// jobs/notificationRetry.js
// Retries verification_communications rows stuck at 'failed'/'retrying' (PRD
// §17) — currently only the SMS channel produces a real failure (see
// requestInformation() in verificationController.js), so this job's retry
// logic is SMS-specific. Bounded to a 72-hour window (getFailedCommunications'
// default) rather than a fixed attempt count — there's no retry-count column
// on verification_communications yet, so a permanently-undeliverable number
// just ages out of that window and stays 'failed', surfaced in the admin
// console, rather than retrying indefinitely.

const { logger } = require('../config/logger');
const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');

async function retryFailedVerificationCommunications() {
  const stuck = await repositories.verification.getFailedCommunications(72);

  if (!stuck.length) {
    logger.info('[NotificationRetry] No failed verification communications to retry');
    return;
  }

  logger.info(`[NotificationRetry] Retrying ${stuck.length} failed verification communication(s)`);

  for (const comm of stuck) {
    if (comm.channel !== 'sms') continue; // only SMS has a real retry path today

    try {
      const application = await repositories.verification.findById(comm.application_id);
      if (!application) continue;

      const profile = await repositories.userProfiles.findByUserId(application.user_id);
      if (!profile?.phone) {
        await repositories.verification.updateCommunicationDeliveryStatus(comm.id, {
          deliveryStatus: 'failed',
          failureReason: 'No phone number on file',
        });
        continue;
      }

      await notificationService.sendSMS({ to: profile.phone, message: comm.message });
      await repositories.verification.updateCommunicationDeliveryStatus(comm.id, { deliveryStatus: 'sent' });
      logger.info(`[NotificationRetry] Successfully retried communication ${comm.id}`);
    } catch (err) {
      await repositories.verification.updateCommunicationDeliveryStatus(comm.id, {
        deliveryStatus: 'failed',
        failureReason: err.message,
      }).catch(() => {});
      logger.error(`[NotificationRetry] Retry failed for communication ${comm.id}:`, err.message);
    }
  }

  logger.info(`[NotificationRetry] Completed — ${stuck.length} communication(s) processed`);
}

module.exports = { retryFailedVerificationCommunications };
