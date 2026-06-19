const repositories = require('../db/repositories');

/**
 * Reusable audit log middleware factory.
 *
 * Usage:
 *   router.post('/products', protect, auditLog('create_product', 'product'), createProduct);
 *
 * Captures the response after it finishes so it knows whether the action
 * succeeded (2xx) or failed (4xx/5xx), records actor, entity, and reason.
 */
const auditLog = (action, entityType) => (req, res, next) => {
  // Intercept res.json to capture the response body without blocking the response
  const originalJson = res.json.bind(res);
  let capturedBody = null;

  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Only log if we have an authenticated user
    if (!req.user) return;

    const failed = res.statusCode >= 400;

    // Resolve entity ID from common param/body locations
    const entityId =
      req.params.id ||
      req.params.productId ||
      req.params.orderId ||
      req.params.deliveryId ||
      req.params.reviewId ||
      req.params.returnId ||
      req.body?.id ||
      null;

    // Strip sensitive fields from metadata before storing
    const safeBody = { ...req.body };
    delete safeBody.password;
    delete safeBody.token;
    delete safeBody.refresh_token;

    repositories.auditLogs.createLog({
      userId: req.user.id,
      action,
      entityType,
      entityId: entityId || undefined,
      metadata: safeBody,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      status: failed ? 'failed' : 'success',
      failureReason: failed
        ? (capturedBody?.error || capturedBody?.message || `HTTP ${res.statusCode}`)
        : null,
    }).catch(() => {
      // Audit log failures must never bubble up to the user
    });
  });

  next();
};

module.exports = { auditLog };
