// jobs/documentExpiry.js
// Daily sweep (PRD §39): any verified verification_documents row whose
// expires_at has passed (driver's licence, insurance, roadworthy, etc.) gets
// flipped to 'expired', which invalidates its owning verification_step and
// reopens the application to action_required — an expired required document
// must not silently keep an application looking "approved".
//
// Shared across both roles: a document's step_key/application_id already
// tells us everything needed, no seller/driver-specific branching required.

const { logger } = require('../config/logger');
const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');

async function sweepExpiredVerificationDocuments() {
  const today = new Date().toISOString().slice(0, 10);
  const expired = await repositories.verification.getExpiringDocuments(today);

  if (!expired.length) {
    logger.info('[DocumentExpiry] No expired verification documents found');
    return;
  }

  logger.info(`[DocumentExpiry] Found ${expired.length} expired verification document(s)`);

  for (const doc of expired) {
    try {
      await repositories.verification.reviewDocument(doc.id, {
        status: 'expired',
        verificationMethod: 'system',
      });

      if (doc.parent_type !== 'application') continue; // vehicle/location-change docs don't gate an application directly
      const application = await repositories.verification.findById(doc.parent_id);
      if (!application) continue;

      await repositories.verification.upsertStep(application.id, doc.step_key, { status: 'action_required' });

      // Only reopen the application if it was previously in a "good" state —
      // don't clobber an already-rejected/draft application's status.
      if (['approved', 'under_review', 'submitted'].includes(application.status)) {
        await repositories.verification.updateApplication(application.id, { status: 'action_required' });
      }

      await repositories.verification.logCommunication({
        applicationId: application.id,
        channel: 'in_app',
        direction: 'outbound',
        message: `Your ${doc.document_type.replace(/_/g, ' ')} document has expired. Please upload a current copy to keep your ${application.role} account active.`,
      });

      await notificationService.sendNotification({
        userId: application.user_id,
        type: 'verification_document_expired',
        title: 'A verification document has expired',
        message: `Your ${doc.document_type.replace(/_/g, ' ')} has expired — please upload a current copy.`,
        relatedId: application.id,
        relatedType: 'verification_application',
      });
    } catch (err) {
      logger.error(`[DocumentExpiry] Failed processing expired document ${doc.id}:`, err.message);
    }
  }

  logger.info(`[DocumentExpiry] Completed — ${expired.length} document(s) processed`);
}

module.exports = { sweepExpiredVerificationDocuments };
