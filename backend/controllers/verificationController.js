// controllers/verificationController.js
// Phase 1 foundation for the unified KYC/verification system: create/resume
// an application, save step data, upload/view documents, capture consent,
// run liveness attempts (evidence, not proof — see plan), submit for review,
// and the admin review actions (list/detail/approve/reject/request-info).
// See migrations/055_verification_system.sql and services/verificationRequirements.js.

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { uploadImage, getPresignedReadUrl } = require('../config/storage');
const notificationService = require('../services/notificationService');
const { invalidateUserAuthCache } = require('../middleware/authMiddleware');
const {
  getRequiredSteps,
  computeOverallProgress,
  isApplicationComplete,
  CURRENT_REQUIREMENTS_VERSION,
  CURRENT_CONSENT_VERSION,
  MAX_LIVENESS_ATTEMPTS,
} = require('../services/verificationRequirements');
const { logger } = require('../config/logger');

const VALID_ROLES = ['seller', 'driver'];

function assertValidRole(role) {
  return VALID_ROLES.includes(role);
}

// ── Applicant endpoints ──────────────────────────────────────────────────

// GET /verification/:role — fetch or create the caller's open application for
// that role, along with its steps and computed progress.
async function getOrCreateApplication(req, res) {
  try {
    const { role } = req.params;
    if (!assertValidRole(role)) return ApiResponse.error(res, 'Invalid role', 400);

    let application = await repositories.verification.findOpenApplication(req.user.id, role);
    if (!application) {
      application = await repositories.verification.createApplication({
        userId: req.user.id,
        role,
        requirementsVersion: CURRENT_REQUIREMENTS_VERSION,
      });
    }

    const steps = await repositories.verification.getStepsForApplication(application.id);
    const requiredSteps = getRequiredSteps(application.role, application.requirements_version);
    const progress = computeOverallProgress(requiredSteps, steps);

    return ApiResponse.withEntity(res, 'application', { ...application, steps, requiredSteps, progress });
  } catch (error) {
    logger.error('getOrCreateApplication failed', { error: error.message, userId: req.user?.id });
    return ApiResponse.error(res, 'Failed to load application', 500);
  }
}

async function _loadOwnedApplication(req, res) {
  const application = await repositories.verification.findById(req.params.applicationId);
  if (!application) {
    ApiResponse.error(res, 'Application not found', 404);
    return null;
  }
  const isOwner = application.user_id === req.user.id;
  const isVerificationAdmin = req.user.roles?.includes('admin') || req.user.roles?.includes('verification_admin');
  if (!isOwner && !isVerificationAdmin) {
    ApiResponse.error(res, 'Not authorized', 403);
    return null;
  }
  return application;
}

// PATCH /verification/:applicationId/steps/:stepKey — save a step's own
// (non-document) form fields; save/resume-friendly (does not require the
// step to be complete to persist partial data).
async function saveStep(req, res) {
  try {
    const application = await _loadOwnedApplication(req, res);
    if (!application) return;

    const { stepKey } = req.params;
    const requiredSteps = getRequiredSteps(application.role, application.requirements_version);
    if (!requiredSteps.includes(stepKey)) return ApiResponse.error(res, 'Unknown step for this role', 400);

    // Identity/liveness are gated behind consent (PRD §5 of the review).
    if (['identity', 'liveness'].includes(stepKey)) {
      const consented = await repositories.verification.hasConsent(application.id, CURRENT_CONSENT_VERSION);
      if (!consented) return ApiResponse.error(res, 'Consent required before this step', 403);
    }

    const { data = {}, status = 'in_progress', matchStatus } = req.body;
    const step = await repositories.verification.upsertStep(application.id, stepKey, {
      data,
      status,
      match_status: matchStatus || null,
      completed_at: status === 'complete' || status === 'verified' ? new Date().toISOString() : null,
    });

    if (application.status === 'draft') {
      await repositories.verification.updateApplication(application.id, { status: 'in_progress' });
    }

    return ApiResponse.withEntity(res, 'step', step);
  } catch (error) {
    logger.error('saveStep failed', { error: error.message, applicationId: req.params.applicationId });
    return ApiResponse.error(res, 'Failed to save step', 500);
  }
}

// POST /verification/:applicationId/consent
async function recordConsent(req, res) {
  try {
    const application = await _loadOwnedApplication(req, res);
    if (!application) return;
    const consent = await repositories.verification.recordConsent(application.id, CURRENT_CONSENT_VERSION);
    return ApiResponse.created(res, consent, 'Consent recorded');
  } catch (error) {
    logger.error('recordConsent failed', { error: error.message });
    return ApiResponse.error(res, 'Failed to record consent', 500);
  }
}

// POST /verification/:applicationId/documents (multipart, field "document")
async function uploadDocument(req, res) {
  try {
    const application = await _loadOwnedApplication(req, res);
    if (!application) return;
    if (!req.file) return ApiResponse.error(res, 'No file provided', 400);

    const { stepKey, documentType, expiresAt, previousDocumentId } = req.body;
    if (!stepKey || !documentType) return ApiResponse.error(res, 'stepKey and documentType are required', 400);

    const uploaded = await uploadImage(req.file, `verification/${application.id}`);
    const documentData = {
      parentType: 'application',
      parentId: application.id,
      stepKey,
      documentType,
      storageKey: uploaded.url, // uploadImage() returns the storage key as `url`
      expiresAt: expiresAt || null,
    };

    const document = previousDocumentId
      ? await repositories.verification.replaceDocument(previousDocumentId, documentData)
      : await repositories.verification.createDocument(documentData);

    return ApiResponse.created(res, document, 'Document uploaded');
  } catch (error) {
    logger.error('uploadDocument failed', { error: error.message, applicationId: req.params.applicationId });
    return ApiResponse.error(res, 'Failed to upload document', 500);
  }
}

// GET /verification/documents/:id/signed-url — the ONLY way to view a
// document. Never exposes storage_key directly; every successful call is
// audit-logged ("break glass" logging per the review), whether the caller is
// the applicant or a verification_admin.
async function getDocumentSignedUrl(req, res) {
  try {
    const document = await repositories.verification.getDocument(req.params.id);
    if (!document || document.deleted_at) return ApiResponse.error(res, 'Document not found', 404);

    let ownerUserId = null;
    if (document.parent_type === 'application') {
      const application = await repositories.verification.findById(document.parent_id);
      ownerUserId = application?.user_id || null;
    }

    const isOwner = ownerUserId && ownerUserId === req.user.id;
    const isVerificationAdmin = req.user.roles?.includes('admin') || req.user.roles?.includes('verification_admin');
    if (!isOwner && !isVerificationAdmin) return ApiResponse.error(res, 'Not authorized', 403);

    const url = await getPresignedReadUrl(document.storage_key, 300); // short-lived, 5 min

    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'verification_document_viewed',
      entityType: 'verification_document',
      entityId: document.id,
      changes: { reason: req.query.reason || null, viewedAsAdmin: !isOwner },
    });

    return ApiResponse.withEntity(res, 'document', { ...document, storage_key: undefined, signedUrl: url });
  } catch (error) {
    logger.error('getDocumentSignedUrl failed', { error: error.message, documentId: req.params.id });
    return ApiResponse.error(res, 'Failed to load document', 500);
  }
}

// POST /verification/:applicationId/liveness — records the on-device result
// as EVIDENCE, not a verdict. Never lets `passed:true` alone move the step
// past 'complete'; enforces the 3-attempt cap before escalating to
// action_required rather than allowing indefinite retries.
async function submitLivenessAttempt(req, res) {
  try {
    const application = await _loadOwnedApplication(req, res);
    if (!application) return;

    const consented = await repositories.verification.hasConsent(application.id, CURRENT_CONSENT_VERSION);
    if (!consented) return ApiResponse.error(res, 'Consent required before liveness', 403);

    const priorAttempts = await repositories.verification.getLivenessAttempts(application.id);
    if (priorAttempts.length >= MAX_LIVENESS_ATTEMPTS) {
      await repositories.verification.upsertStep(application.id, 'liveness', { status: 'action_required' });
      await repositories.verification.updateApplication(application.id, { status: 'action_required' });
      await repositories.verification.logCommunication({
        applicationId: application.id,
        channel: 'in_app',
        direction: 'outbound',
        message: 'You have reached the maximum number of liveness verification attempts. Please contact support for manual verification.',
      });
      return ApiResponse.error(res, 'Maximum liveness attempts reached — escalated to manual review', 429);
    }

    // multipart/form-data (matches uploadDocument's convention) — the
    // captured frame is an optional file (req.file), everything else arrives
    // as string form fields.
    const { passed, challengeSequence, antiSpoofScore, methodVersion, deviceInfo, appVersion } = req.body;

    let capturedFrameKey = null;
    if (req.file) {
      const uploaded = await uploadImage(req.file, `verification/${application.id}/liveness`);
      capturedFrameKey = uploaded.url;
    }

    const attempt = await repositories.verification.createLivenessAttempt(application.id, {
      passed: passed === true || passed === 'true',
      challengeSequence,
      antiSpoofScore: antiSpoofScore !== undefined && antiSpoofScore !== '' ? Number(antiSpoofScore) : null,
      capturedFrameKey,
      methodVersion: methodVersion || 'on_device_v1',
      deviceInfo,
      appVersion,
    });

    // A passing on-device attempt only reaches 'complete' — evidence for
    // admin review. It is the admin who moves this to 'verified'.
    await repositories.verification.upsertStep(application.id, 'liveness', {
      status: passed ? 'complete' : 'in_progress',
    });

    return ApiResponse.created(res, attempt, 'Liveness attempt recorded');
  } catch (error) {
    logger.error('submitLivenessAttempt failed', { error: error.message, applicationId: req.params.applicationId });
    return ApiResponse.error(res, 'Failed to record liveness attempt', 500);
  }
}

// The wizard only ever writes step data into verification_steps.data (draft
// JSONB) — it never touches the operational `stores` table directly. The
// actual store row (the thing products/orders/dashboard depend on) gets
// created here, once, the first time a seller submits — assembled from the
// business/shop_location/payout/personal_info step data, mirroring the
// field mapping businessController.js's createBusiness() already uses so
// the resulting store looks identical either way.
async function _createStoreFromApplication(application, steps, userId) {
  const stepData = Object.fromEntries(steps.map(s => [s.step_key, s.data || {}]));
  const business = stepData.business || {};
  const shop = stepData.shop_location || {};
  const payout = stepData.payout || {};
  const personal = stepData.personal_info || {};

  const documents = await repositories.verification.getDocumentsForParent('application', application.id);
  const latestDocOfType = (type) => documents
    .filter(d => d.document_type === type && !d.deleted_at)
    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))[0];

  const businessName = business.businessName || shop.shopName || 'My Store';
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

  // stores.description/phone/address_line1/city/country/category are all
  // NOT NULL — fall back to empty string (never null) so a gap in the
  // wizard's step data can't turn into a DB constraint violation that blocks
  // submission entirely; these fields ARE marked required in the wizard UI,
  // this is just a safety net.
  const store = await repositories.stores.create({
    owner_id: userId,
    store_name: businessName,
    slug,
    description: business.description || shop.shopDescription || '',
    category: business.businessCategory || 'general',
    phone: personal.phone || '',
    email: personal.email || null,
    address_line1: shop.addressLine1 || '',
    city: shop.city || '',
    state_province: shop.region || null,
    country: shop.country || personal.countryOfResidence || '',
    registration_number: business.registrationNumber || null,
    business_cert_url: latestDocOfType('business_cert')?.storage_key || null,
    ghana_card_url: latestDocOfType('identity')?.storage_key || null,
    proof_of_bank_url: latestDocOfType('proof_of_bank')?.storage_key || null,
    payout_method: payout.payoutMethod || null,
    payout_details: {
      accountHolderName: payout.accountHolderName || null,
      accountNumber: payout.accountNumber || null,
      providerOrBankName: payout.providerOrBankName || null,
    },
  });

  return store;
}

// POST /verification/:applicationId/submit
async function submitApplication(req, res) {
  try {
    const application = await _loadOwnedApplication(req, res);
    if (!application) return;

    const steps = await repositories.verification.getStepsForApplication(application.id);
    const requiredSteps = getRequiredSteps(application.role, application.requirements_version);
    const allStepsAtLeastComplete = requiredSteps.every(key => {
      const step = steps.find(s => s.step_key === key);
      return step && ['complete', 'verified'].includes(step.status);
    });
    if (!allStepsAtLeastComplete) {
      return ApiResponse.error(res, 'All required steps must be completed before submitting', 400);
    }

    let entityId = application.entity_id;
    if (!entityId && application.role === 'seller') {
      const store = await _createStoreFromApplication(application, steps, application.user_id);
      entityId = store.id;
    }

    const updated = await repositories.verification.updateApplication(application.id, {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      entity_id: entityId,
    });
    await repositories.verification.updateApplication(application.id, { status: 'under_review' });

    // notifyAdminsVerificationRequest() hardcodes a store-vs-driver title/type
    // pair (legacy helper) — not reused here since this endpoint serves both
    // seller and driver applications generically.
    const admins = await repositories.users.getAdmins();
    for (const admin of admins || []) {
      await notificationService.sendNotification({
        userId: admin.id,
        type: 'verification_submitted',
        title: `New ${application.role} verification submitted`,
        message: `${req.user.email} has submitted a ${application.role} verification application for review.`,
        relatedId: application.id,
        relatedType: 'verification_application',
      });
    }

    return ApiResponse.withEntity(res, 'application', updated, 'Application submitted for review');
  } catch (error) {
    logger.error('submitApplication failed', { error: error.message, applicationId: req.params.applicationId });
    return ApiResponse.error(res, 'Failed to submit application', 500);
  }
}

// POST /verification/shop-location-change — an already-approved seller
// requesting to move their shop. Their current verified location/store stays
// fully operational while this is pending; only admin review flips it.
async function requestShopLocationChange(req, res) {
  try {
    const { storeId, addressLine1, city, region, latitude, longitude } = req.body;
    if (!storeId) return ApiResponse.error(res, 'storeId is required', 400);

    const store = await repositories.stores.findById(storeId);
    if (!store) return ApiResponse.error(res, 'Store not found', 404);
    if (store.owner_id !== req.user.id && !req.user.roles?.includes('admin')) {
      return ApiResponse.error(res, 'Not authorized', 403);
    }

    const change = await repositories.verification.createShopLocationChange(storeId, {
      addressLine1, city, region, latitude, longitude,
    });
    return ApiResponse.created(res, change, 'Location change submitted for review');
  } catch (error) {
    logger.error('requestShopLocationChange failed', { error: error.message });
    return ApiResponse.error(res, 'Failed to submit location change', 500);
  }
}

// ── Admin endpoints ───────────────────────────────────────────────────────

// GET /admin/verifications
async function listApplicationsAdmin(req, res) {
  try {
    const { role, status, riskLevel, limit, offset } = req.query;
    const result = await repositories.verification.listApplicationsAdmin({
      role, status, riskLevel,
      limit: limit ? Number(limit) : 25,
      offset: offset ? Number(offset) : 0,
    });
    return ApiResponse.paginated(res, result.applications, { total: result.total });
  } catch (error) {
    logger.error('listApplicationsAdmin failed', { error: error.message });
    return ApiResponse.error(res, 'Failed to list applications', 500);
  }
}

// GET /admin/verifications/:id
async function getApplicationDetailAdmin(req, res) {
  try {
    const application = await repositories.verification.getApplicationWithSteps(req.params.id);
    if (!application) return ApiResponse.error(res, 'Application not found', 404);

    const documents = await repositories.verification.getDocumentsForParent('application', application.id);
    const livenessAttempts = await repositories.verification.getLivenessAttempts(application.id);
    const communications = await repositories.verification.getCommunications(application.id);

    return ApiResponse.withEntity(res, 'application', {
      ...application,
      documents: documents.map(d => ({ ...d, storage_key: undefined })), // view individually via the signed-url endpoint
      livenessAttempts: livenessAttempts.map(a => ({ ...a, captured_frame_key: undefined })),
      communications,
    });
  } catch (error) {
    logger.error('getApplicationDetailAdmin failed', { error: error.message, id: req.params.id });
    return ApiResponse.error(res, 'Failed to load application', 500);
  }
}

// PUT /admin/verifications/:id/approve — only possible once every required
// step is 'verified' (an admin must have explicitly confirmed identity/
// liveness/documents first; a passing on-device liveness claim alone is not
// enough — see isApplicationComplete).
async function approveApplication(req, res) {
  try {
    const application = await repositories.verification.findById(req.params.id);
    if (!application) return ApiResponse.error(res, 'Application not found', 404);

    const steps = await repositories.verification.getStepsForApplication(application.id);
    if (!isApplicationComplete(application, steps)) {
      return ApiResponse.error(res, 'Not all required steps are verified yet', 400);
    }

    const updated = await repositories.verification.updateApplication(application.id, {
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user.id,
    });

    // Additive (upsert) — does not clear the user's other roles, so an
    // approved seller who is also a pending/approved driver keeps both
    // (see plan §Multi-role independence).
    const role = await repositories.roles.findByName(application.role);
    if (role) await repositories.roles.assignRoleToUser(application.user_id, role.id);
    await invalidateUserAuthCache(application.user_id);

    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'verification_application_approved',
      entityType: 'verification_application',
      entityId: application.id,
      changes: { status: 'approved' },
    });

    await notificationService.sendNotification({
      userId: application.user_id,
      type: 'verification_approved',
      title: 'Verification approved',
      message: `Your ${application.role} verification has been approved.`,
      relatedId: application.id,
      relatedType: 'verification_application',
    });

    return ApiResponse.withEntity(res, 'application', updated, 'Application approved');
  } catch (error) {
    logger.error('approveApplication failed', { error: error.message, id: req.params.id });
    return ApiResponse.error(res, 'Failed to approve application', 500);
  }
}

// PUT /admin/verifications/:id/reject
async function rejectApplication(req, res) {
  try {
    const { reason } = req.body;
    if (!reason) return ApiResponse.error(res, 'Rejection reason is required', 400);

    const application = await repositories.verification.findById(req.params.id);
    if (!application) return ApiResponse.error(res, 'Application not found', 404);

    const updated = await repositories.verification.updateApplication(application.id, {
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: req.user.id,
    });

    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'verification_application_rejected',
      entityType: 'verification_application',
      entityId: application.id,
      changes: { status: 'rejected', reason },
    });

    await notificationService.sendNotification({
      userId: application.user_id,
      type: 'verification_rejected',
      title: 'Verification rejected',
      message: reason,
      relatedId: application.id,
      relatedType: 'verification_application',
    });

    return ApiResponse.withEntity(res, 'application', updated, 'Application rejected');
  } catch (error) {
    logger.error('rejectApplication failed', { error: error.message, id: req.params.id });
    return ApiResponse.error(res, 'Failed to reject application', 500);
  }
}

// PUT /admin/verifications/:id/request-information
async function requestInformation(req, res) {
  try {
    const { message } = req.body;
    if (!message) return ApiResponse.error(res, 'A message describing what is needed is required', 400);

    const application = await repositories.verification.findById(req.params.id);
    if (!application) return ApiResponse.error(res, 'Application not found', 404);

    const updated = await repositories.verification.updateApplication(application.id, { status: 'action_required' });

    await repositories.verification.logCommunication({
      applicationId: application.id,
      adminId: req.user.id,
      channel: req.body.channel || 'in_app',
      direction: 'outbound',
      message,
    });

    await notificationService.sendNotification({
      userId: application.user_id,
      type: 'verification_action_required',
      title: 'Additional information required',
      message,
      relatedId: application.id,
      relatedType: 'verification_application',
    });

    return ApiResponse.withEntity(res, 'application', updated, 'Information requested');
  } catch (error) {
    logger.error('requestInformation failed', { error: error.message, id: req.params.id });
    return ApiResponse.error(res, 'Failed to request information', 500);
  }
}

module.exports = {
  getOrCreateApplication,
  saveStep,
  recordConsent,
  uploadDocument,
  getDocumentSignedUrl,
  submitLivenessAttempt,
  submitApplication,
  requestShopLocationChange,
  listApplicationsAdmin,
  getApplicationDetailAdmin,
  approveApplication,
  rejectApplication,
  requestInformation,
};
