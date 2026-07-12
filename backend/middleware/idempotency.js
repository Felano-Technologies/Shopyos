// middleware/idempotency.js
// Stripe-style idempotency for POST requests.
//
// Mobile networks routinely deliver a request and lose the response (stale
// keep-alive sockets on Android), so the client shows an error for an action
// that actually succeeded — and a blind retry would perform it twice.
// The client stamps every POST with an X-Idempotency-Key; the first execution
// caches its response in Redis, and any retry with the same key replays that
// response instead of re-executing the handler.

const crypto = require('node:crypto');
const { cacheGet, cacheSet, acquireLock } = require('../config/redis');
const { logger } = require('../config/logger');

const RESPONSE_TTL_SECONDS = 3600; // replays possible for 1h — covers any retry window
const LOCK_TTL_SECONDS = 60;       // max time the first execution may hold the key

const idempotency = async (req, res, next) => {
  const headerKey = req.headers['x-idempotency-key'];
  if (req.method !== 'POST' || !headerKey || typeof headerKey !== 'string' || headerKey.length > 128) {
    return next();
  }

  // Scope keys per caller so one user's key can never replay another's
  // response. Scope must be STABLE across retries: mobile/VPN source IPs
  // rotate between an attempt and its retry, so IP-scoping caused cache
  // misses and duplicate execution. The auth header survives retries.
  const auth = req.headers.authorization;
  const scope = auth
    ? crypto.createHash('sha256').update(auth).digest('hex').slice(0, 16)
    : (req.ip || 'anon');
  const cacheKey = `idem:${scope}:${headerKey}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached?.status) {
      res.set('X-Idempotent-Replay', 'true');
      return res.status(cached.status).json(cached.body);
    }

    // First time we see this key: take the in-flight lock. A concurrent
    // duplicate gets a retryable 409 instead of executing twice.
    const gotLock = await acquireLock(`${cacheKey}:lock`, LOCK_TTL_SECONDS);
    if (!gotLock) {
      return res.status(409).json({
        success: false,
        code: 'IDEMPOTENT_IN_FLIGHT',
        error: 'This request is already being processed. Please retry in a moment.'
      });
    }
  } catch (err) {
    // Redis being down must never block requests — proceed without idempotency
    logger.warn('Idempotency middleware degraded (continuing without):', err.message);
    return next();
  }

  // Capture the response and store it for replay. 5xx responses are not
  // cached so genuine server failures can be retried fresh.
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 500) {
      cacheSet(cacheKey, { status: res.statusCode, body }, RESPONSE_TTL_SECONDS)
        .catch((e) => logger.warn('Idempotency response cache failed:', e.message));
    }
    return originalJson(body);
  };

  next();
};

module.exports = { idempotency };
