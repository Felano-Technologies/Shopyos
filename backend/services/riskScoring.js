// services/riskScoring.js
// Phase 5 — additive risk scoring (PRD §43). Deliberately simple and purely
// advisory: the score/level ONLY inform admin prioritization/filtering in
// the console — nothing here auto-rejects or auto-suspends an account.
// That matters concretely in a dense urban market like Accra, where
// signals like a shared phone number or IP are common between legitimate,
// unrelated sellers (family members sharing a line, a shared shop wifi) and
// must never be treated as proof of fraud on their own.

const { getPool } = require('../config/postgres');
const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

const RISK_LEVEL_THRESHOLDS = [
  { max: 30, level: 'low' },
  { max: 60, level: 'medium' },
  { max: 80, level: 'high' },
  { max: 100, level: 'critical' },
];

function levelForScore(score) {
  return (RISK_LEVEL_THRESHOLDS.find(t => score <= t.max) || RISK_LEVEL_THRESHOLDS.at(-1)).level;
}

async function _countAccountsWithPhone(phone, excludeUserId) {
  if (!phone) return 0;
  const db = getPool();
  const { rows } = await db.query(
    `SELECT COUNT(*) FROM user_profiles WHERE phone = $1 AND user_id != $2`,
    [phone, excludeUserId]
  );
  return Number.parseInt(rows[0].count, 10) || 0;
}

// Computes a fresh score for one application — does not persist it (see
// recomputeAndStoreRiskScore for that), so it can also be used read-only
// (e.g. a future "preview" admin action) without side effects.
async function computeRiskScore(application) {
  const { verification, userProfiles } = repositories;
  const signals = [];
  let score = 0;

  const attempts = await verification.getLivenessAttempts(application.id);
  const failedAttempts = attempts.filter(a => !a.passed).length;
  if (failedAttempts > 0) {
    score += Math.min(failedAttempts * 10, 30);
    signals.push(`${failedAttempts} failed liveness attempt(s)`);
  }

  const documents = await verification.getDocumentsForParent('application', application.id);
  const rejectedDocs = documents.filter(d => d.status === 'rejected').length;
  if (rejectedDocs > 0) {
    score += Math.min(rejectedDocs * 15, 30);
    signals.push(`${rejectedDocs} rejected document(s)`);
  }

  const profile = await userProfiles.findByUserId(application.user_id);
  if (profile?.phone) {
    const dupCount = await _countAccountsWithPhone(profile.phone, application.user_id);
    if (dupCount > 0) {
      score += 20;
      signals.push(`Phone number shared with ${dupCount} other account(s)`);
    }
  }

  score = Math.min(score, 100);
  return { score, level: levelForScore(score), signals };
}

// Recomputes and persists the score onto verification_applications — called
// at submission and after every admin review action (approve/reject), per
// plan. Never throws into the caller's flow — a scoring failure must not
// block submission/approval itself.
async function recomputeAndStoreRiskScore(applicationId) {
  try {
    const application = await repositories.verification.findById(applicationId);
    if (!application) return null;

    const { score, level, signals } = await computeRiskScore(application);
    await repositories.verification.updateApplication(applicationId, { risk_score: score, risk_level: level });
    return { score, level, signals };
  } catch (error) {
    logger.error('recomputeAndStoreRiskScore failed', { error: error.message, applicationId });
    return null;
  }
}

module.exports = { computeRiskScore, recomputeAndStoreRiskScore };
