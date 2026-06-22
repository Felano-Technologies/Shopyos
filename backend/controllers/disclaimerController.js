// controllers/disclaimerController.js
const repositories = require('../db/repositories');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');

/**
 * Get active disclaimer by type (with caching)
 */
const getDisclaimer = async (req, res, next) => {
  try {
    const { type } = req.params;
    const cacheKey = `disclaimer:${type}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.status(200).json({ success: true, disclaimer: cached });
    }

    const disclaimer = await repositories.disclaimers.getByType(type);
    if (!disclaimer) {
      return res.status(404).json({ success: false, error: 'Disclaimer not found' });
    }

    await cacheSet(cacheKey, disclaimer, 300);
    res.status(200).json({ success: true, disclaimer });
  } catch (error) {
    next(error);
  }
};

/**
 * Log user consent / acknowledgement of a disclaimer
 */
const acknowledgeDisclaimer = async (req, res, next) => {
  try {
    const { disclaimerType, version, contextId, contextType } = req.body;
    const userId = req.user.id;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!disclaimerType || !version) {
      return res.status(400).json({ success: false, error: 'disclaimerType and version are required' });
    }

    const ack = await repositories.disclaimers.createAcknowledgement(
      userId, disclaimerType, version, contextId, contextType, ip, userAgent
    );

    res.status(201).json({ success: true, acknowledgement: ack });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if the buyer/seller has accepted a disclaimer
 */
const checkAcknowledgement = async (req, res, next) => {
  try {
    const { type, version, contextId } = req.query;
    const userId = req.user.id;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Disclaimer type is required' });
    }

    const ack = await repositories.disclaimers.checkAcknowledgement(userId, type, version, contextId);
    res.status(200).json({ success: true, acknowledged: ack !== null, acknowledgement: ack });
  } catch (error) {
    next(error);
  }
};

/**
 * Update disclaimer content (admin only)
 */
const updateDisclaimer = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { title, content, version } = req.body;

    if (!title || !content || !version) {
      return res.status(400).json({ success: false, error: 'Title, content, and version are required' });
    }

    const updated = await repositories.disclaimers.updateDisclaimer(type, title, content, version, req.user.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Disclaimer not found' });
    }

    // Invalidate Redis cache
    await cacheDel(`disclaimer:${type}`);

    res.status(200).json({ success: true, disclaimer: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all acknowledgements audit trail (admin only)
 */
const getAcknowledgementsAudit = async (req, res, next) => {
  try {
    const { type, limit } = req.query;
    const maxLimit = limit ? parseInt(limit, 10) : 50;

    const audit = await repositories.disclaimers.getAcknowledgementsAudit(type, maxLimit);
    res.status(200).json({ success: true, audit });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDisclaimer,
  acknowledgeDisclaimer,
  checkAcknowledgement,
  updateDisclaimer,
  getAcknowledgementsAudit,
};
