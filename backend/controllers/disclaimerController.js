// controllers/disclaimerController.js
const repositories = require('../db/repositories');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get active disclaimer by type (with caching)
 */
const getDisclaimer = async (req, res, next) => {
  try {
    const { type } = req.params;
    const cacheKey = `disclaimer:${type}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return ApiResponse.withEntity(res, 'disclaimer', cached);
    }

    const disclaimer = await repositories.disclaimers.getByType(type);
    if (!disclaimer) {
      return ApiResponse.error(res, 'Disclaimer not found', 404);
    }

    await cacheSet(cacheKey, disclaimer, 300);
    ApiResponse.withEntity(res, 'disclaimer', disclaimer);
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
      return ApiResponse.error(res, 'disclaimerType and version are required', 400);
    }

    const ack = await repositories.disclaimers.createAcknowledgement(
      userId, disclaimerType, version, contextId, contextType, ip, userAgent
    );

    ApiResponse.withEntity(res, 'acknowledgement', ack, null, null, 201);
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
      return ApiResponse.error(res, 'Disclaimer type is required', 400);
    }

    const ack = await repositories.disclaimers.checkAcknowledgement(userId, type, version, contextId);
    ApiResponse.success(res, { acknowledged: ack !== null, acknowledgement: ack });
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
      return ApiResponse.error(res, 'Title, content, and version are required', 400);
    }

    const updated = await repositories.disclaimers.updateDisclaimer(type, title, content, version, req.user.id);
    if (!updated) {
      return ApiResponse.error(res, 'Disclaimer not found', 404);
    }

    // Invalidate Redis cache
    await cacheDel(`disclaimer:${type}`);

    ApiResponse.withEntity(res, 'disclaimer', updated);
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
    ApiResponse.withEntity(res, 'audit', audit);
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
