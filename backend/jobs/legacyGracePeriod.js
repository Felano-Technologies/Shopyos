// jobs/legacyGracePeriod.js
// Enforces the grace period on backfilled pre-existing sellers/drivers (see
// migrations/056/058 — legacy_migrated=true, verification_required_by set
// at backfill time). Nothing changes for these accounts immediately; once
// the deadline passes, any legacy application still missing a requirement
// that didn't exist under the old system (consent capture, since backfilled
// steps were all marked 'verified' directly) gets reopened — restricting
// only that gap, not an immediate full suspension.

const { logger } = require('../config/logger');
const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');
const { CURRENT_CONSENT_VERSION } = require('../services/verificationRequirements');

async function enforceLegacyGracePeriod() {
  const today = new Date().toISOString();
  const { applications } = await repositories.verification.listApplicationsAdmin({ limit: 1000 });

  const overdue = applications.filter(app =>
    app.legacy_migrated &&
    app.status === 'approved' &&
    app.verification_required_by &&
    new Date(app.verification_required_by).toISOString() <= today
  );

  if (!overdue.length) {
    logger.info('[LegacyGracePeriod] No overdue legacy applications found');
    return;
  }

  logger.info(`[LegacyGracePeriod] Found ${overdue.length} overdue legacy application(s)`);

  for (const application of overdue) {
    try {
      const hasConsent = await repositories.verification.hasConsent(application.id, CURRENT_CONSENT_VERSION);
      if (hasConsent) continue; // already caught up under the new system, nothing to do

      // Reopen only the identity/liveness gate (the two steps consent
      // actually guards) — every other backfilled 'verified' step stays as-is.
      await repositories.verification.upsertStep(application.id, 'liveness', { status: 'action_required' });
      await repositories.verification.updateApplication(application.id, { status: 'action_required' });

      await repositories.verification.logCommunication({
        applicationId: application.id,
        channel: 'in_app',
        direction: 'outbound',
        message: 'Your account predates our current identity verification process. Please complete a quick consent + liveness check to keep your account active.',
      });

      await notificationService.sendNotification({
        userId: application.user_id,
        type: 'verification_grace_period_expired',
        title: 'Action needed: verify your identity',
        message: 'Please complete a quick consent + liveness check to keep your account active.',
        relatedId: application.id,
        relatedType: 'verification_application',
      });
    } catch (err) {
      logger.error(`[LegacyGracePeriod] Failed processing application ${application.id}:`, err.message);
    }
  }

  logger.info(`[LegacyGracePeriod] Completed — ${overdue.length} application(s) processed`);
}

module.exports = { enforceLegacyGracePeriod };
