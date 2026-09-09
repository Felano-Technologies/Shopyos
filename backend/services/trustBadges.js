// services/trustBadges.js
// Phase 5 — buyer-facing trust indicators (PRD §40/§41). Deliberately NOT a
// single generic "Verified" flag: each badge only appears when the specific
// underlying step is actually 'verified' (never just 'complete'/submitted),
// so an informal seller who hasn't formally registered their business shows
// Identity Verified without ever implying Business Verified — see plan
// §Ownership & authorization relationships and the PRD's Kojo's Shoes vs.
// Ama's Fashion example.

function _stepVerified(steps, key) {
  return steps.some(s => s.step_key === key && s.status === 'verified');
}

// Returns badge keys only — the caller decides display copy/icons.
function getTrustBadges(application, steps) {
  if (!application || !steps) return [];
  const badges = [];

  if (_stepVerified(steps, 'identity')) badges.push('identity_verified');

  if (application.role === 'seller') {
    if (_stepVerified(steps, 'business')) badges.push('business_verified');
    if (_stepVerified(steps, 'shop_location')) badges.push('location_verified');
    if (application.status === 'approved' && badges.includes('identity_verified') && badges.includes('business_verified') && badges.includes('location_verified')) {
      badges.push('shopyos_verified_seller');
    }
  }

  if (application.role === 'driver') {
    if (_stepVerified(steps, 'driver_licence')) badges.push('licence_verified');
    if (_stepVerified(steps, 'vehicle_docs')) badges.push('vehicle_verified');
    if (application.status === 'approved' && badges.includes('identity_verified') && badges.includes('licence_verified') && badges.includes('vehicle_verified')) {
      badges.push('verified_driver');
    }
  }

  return badges;
}

module.exports = { getTrustBadges };
