// middleware/requireDisclaimer.js
const repositories = require('../db/repositories');

/**
 * Middleware to enforce that a user has acknowledged the latest version of a legal disclaimer
 * @param {string} disclaimerType - The type of disclaimer (e.g. 'refund_policy', 'bargain_terms')
 */
const requireDisclaimer = (disclaimerType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Fetch the latest active disclaimer details
      const activeDisclaimer = await repositories.disclaimers.getByType(disclaimerType);
      if (!activeDisclaimer) {
        // Fallback: if disclaimer not configured yet, skip enforcement
        return next();
      }

      // Context ID could be an order ID, bargain ID, etc.
      const contextId = req.body.contextId || req.body.orderId || req.params.id || null;

      // Check if user has acknowledged this version
      const acknowledged = await repositories.disclaimers.checkAcknowledgement(
        userId,
        disclaimerType,
        activeDisclaimer.version,
        contextId
      );

      if (!acknowledged) {
        return res.status(403).json({
          success: false,
          error: 'Disclaimer acknowledgement required',
          requiresAcknowledgement: true,
          disclaimer: {
            type: activeDisclaimer.type,
            version: activeDisclaimer.version,
            title: activeDisclaimer.title,
            content: activeDisclaimer.content,
          },
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = requireDisclaimer;
