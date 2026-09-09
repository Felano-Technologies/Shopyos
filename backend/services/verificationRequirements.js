// services/verificationRequirements.js
// The verification "requirement engine" (PRD §45): a static, versioned config
// of which steps each role must complete, plus the two authoritative
// activation checks (`canActivateSeller`/`canActivateDriver`) that every
// call site — authMiddleware's requireVerified, the admin console's Approve
// button, notification triggers — should use instead of re-deriving
// completeness ad hoc.
//
// Versioning: a policy change adds a new numbered key. An application is
// permanently pinned to the `requirements_version` it was created with
// (verification_applications.requirements_version) so an in-flight applicant
// never gets a requirement retroactively added mid-application.

const REQUIREMENTS = {
  1: {
    seller: ['personal_info', 'identity', 'liveness', 'business', 'shop_location', 'payout', 'training'],
    driver: ['personal_info', 'identity', 'liveness', 'driver_licence', 'vehicle', 'vehicle_docs', 'operating_location', 'emergency_contact', 'training'],
  },
};

const CURRENT_REQUIREMENTS_VERSION = 1;
const CURRENT_CONSENT_VERSION = 1;
const MAX_LIVENESS_ATTEMPTS = 3;

function getRequiredSteps(role, requirementsVersion = CURRENT_REQUIREMENTS_VERSION) {
  const versionConfig = REQUIREMENTS[requirementsVersion];
  if (!versionConfig || !versionConfig[role]) {
    throw new Error(`No requirement set for role="${role}" requirements_version=${requirementsVersion}`);
  }
  return versionConfig[role];
}

function computeOverallProgress(requiredSteps, steps) {
  if (!requiredSteps.length) return 100;
  const byKey = new Map(steps.map(s => [s.step_key, s]));
  const weight = { not_started: 0, in_progress: 0.5, action_required: 0.5, rejected: 0.25, complete: 0.85, verified: 1 };
  const total = requiredSteps.reduce((sum, key) => {
    const step = byKey.get(key);
    return sum + (step ? (weight[step.status] ?? 0) : 0);
  }, 0);
  return Math.round((total / requiredSteps.length) * 100);
}

function isApplicationComplete(application, steps) {
  const requiredSteps = getRequiredSteps(application.role, application.requirements_version);
  const byKey = new Map(steps.map(s => [s.step_key, s]));
  return requiredSteps.every(key => byKey.get(key)?.status === 'verified');
}

// The single authoritative gate: every backend authorization check, the
// admin console's Approve button, and activation notifications must all call
// through this (or canActivateDriver) rather than re-deriving completeness.
function canActivateSeller(application, steps) {
  if (application.role !== 'seller') return false;
  if (application.status !== 'approved') return false;
  return isApplicationComplete(application, steps);
}

function canActivateDriver(application, steps) {
  if (application.role !== 'driver') return false;
  if (application.status !== 'approved') return false;
  return isApplicationComplete(application, steps);
}

module.exports = {
  REQUIREMENTS,
  CURRENT_REQUIREMENTS_VERSION,
  CURRENT_CONSENT_VERSION,
  MAX_LIVENESS_ATTEMPTS,
  getRequiredSteps,
  computeOverallProgress,
  isApplicationComplete,
  canActivateSeller,
  canActivateDriver,
};
