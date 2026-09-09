// routes/adminVerificationRoutes.js
// Admin review endpoints for the unified KYC/verification system. Mounted
// separately from adminRoutes.js because that router gates everything on the
// plain 'admin' role — verification needs finer tiers (verification_admin,
// support_admin) to also get in, per plan §Admin permission tiers.

const express = require('express');
const router = express.Router();
const { protect, hasAnyRole, hasVerificationPermission } = require('../middleware/authMiddleware');
const {
  listApplicationsAdmin,
  getApplicationDetailAdmin,
  approveApplication,
  rejectApplication,
  requestInformation,
  logInternalNote,
  assistedEditStep,
} = require('../controllers/verificationController');

router.use(protect);
router.use(hasAnyRole('admin', 'verification_admin', 'support_admin'));

router.get('/', listApplicationsAdmin);
router.get('/:id', getApplicationDetailAdmin);
// Approve/reject require the full verification_admin tier — support_admin
// can request information but not make the approval decision itself.
router.put('/:id/approve', hasVerificationPermission('verification_admin'), approveApplication);
router.put('/:id/reject', hasVerificationPermission('verification_admin'), rejectApplication);
router.put('/:id/request-information', hasVerificationPermission('verification_admin', 'support_admin'), requestInformation);
router.post('/:id/notes', hasVerificationPermission('verification_admin', 'support_admin'), logInternalNote);
// Assisted onboarding — only the full verification_admin tier may write
// directly into an applicant's step data (see plan §Admin permission tiers).
router.patch('/:id/steps/:stepKey', hasVerificationPermission('verification_admin'), assistedEditStep);

module.exports = router;
