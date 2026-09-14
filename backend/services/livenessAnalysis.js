// services/livenessAnalysis.js
// Orchestrates the real, server-side liveness verdict from raw uploaded
// frame buffers: face+landmark detection (yoloFaceDetector), anti-spoof
// classification on the baseline frame (antiSpoofClassifier), and
// challenge-response verification per non-baseline frame
// (challengeVerifier). This is what actually computes `passed` now —
// the client's own `passed:true` is no longer trusted, only recorded
// alongside as the on-device claim for comparison/fraud-signal purposes.
//
// Still evidence-for-admin-review per the plan (a passing verdict here only
// ever moves the liveness step to 'complete', never 'verified' — an admin
// action does that) but now the 'complete' claim is backed by a real
// analysis instead of an unverified client report.

const sharp = require('sharp');
const { detectFace } = require('./liveness/yoloFaceDetector');
const { classify } = require('./liveness/antiSpoofClassifier');
const { verify, SUPPORTED_CHALLENGES } = require('./liveness/challengeVerifier');
const { logger } = require('../config/logger');

const MIN_FACE_CONFIDENCE = 0.5;
const MIN_REAL_SCORE = 0.5;

// frames: [{ label: string, buffer: Buffer }], baseline frame must have
// label === 'baseline'. challengeSequence: string[] of challenge ids in the
// order they were presented (must match the frame labels, minus baseline).
//
// Returns:
// {
//   passed: boolean,
//   faceDetected: boolean,
//   antiSpoofScore: number|null,   // baseline frame's realScore
//   isReal: boolean|null,
//   challengeResults: { [challengeId]: { passed, signal, delta } },
//   reason: string|null,           // set when passed=false, for admin/debug visibility
// }
async function analyzeLivenessAttempt(frames, challengeSequence = []) {
  const result = {
    passed: false,
    faceDetected: false,
    antiSpoofScore: null,
    isReal: null,
    challengeResults: {},
    reason: null,
  };

  try {
    const baselineFrame = frames.find((f) => f.label === 'baseline');
    if (!baselineFrame) {
      result.reason = 'missing_baseline_frame';
      return result;
    }

    const baselineMeta = await sharp(baselineFrame.buffer).metadata();
    const baselineDetection = await detectFace(baselineFrame.buffer);
    if (!baselineDetection || baselineDetection.confidence < MIN_FACE_CONFIDENCE) {
      result.reason = 'no_face_in_baseline';
      return result;
    }
    result.faceDetected = true;

    const antiSpoof = await classify(
      baselineFrame.buffer,
      baselineDetection.box,
      baselineMeta.width,
      baselineMeta.height
    );
    if (!antiSpoof) {
      result.reason = 'anti_spoof_analysis_failed';
      return result;
    }
    result.antiSpoofScore = antiSpoof.realScore;
    result.isReal = antiSpoof.isReal;

    if (!antiSpoof.isReal || antiSpoof.realScore < MIN_REAL_SCORE) {
      result.reason = 'anti_spoof_failed';
      return result;
    }

    const challengesToVerify = challengeSequence.filter((id) => SUPPORTED_CHALLENGES.includes(id));
    if (!challengesToVerify.length) {
      result.reason = 'no_supported_challenges';
      return result;
    }

    let allChallengesPassed = true;
    for (const challengeId of challengesToVerify) {
      const challengeFrame = frames.find((f) => f.label === challengeId);
      if (!challengeFrame) {
        result.challengeResults[challengeId] = { passed: false, signal: null, delta: null };
        allChallengesPassed = false;
        continue;
      }

      const challengeDetection = await detectFace(challengeFrame.buffer);
      if (!challengeDetection || challengeDetection.confidence < MIN_FACE_CONFIDENCE) {
        result.challengeResults[challengeId] = { passed: false, signal: null, delta: null };
        allChallengesPassed = false;
        continue;
      }

      const verdict = verify(challengeId, baselineDetection.landmarks, challengeDetection.landmarks);
      result.challengeResults[challengeId] = verdict;
      if (!verdict.passed) allChallengesPassed = false;
    }

    result.passed = allChallengesPassed;
    if (!allChallengesPassed) result.reason = 'challenge_verification_failed';
    return result;
  } catch (error) {
    logger.error('analyzeLivenessAttempt failed', { error: error.message });
    result.reason = 'analysis_error';
    return result;
  }
}

module.exports = { analyzeLivenessAttempt };
