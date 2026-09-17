// Verifies a "Sign in with Apple" identity token (a signed JWT) against
// Apple's published JWKS. Unlike Google, Apple has no simple REST
// "tokeninfo" endpoint to introspect a token — verification means fetching
// Apple's public keys and checking the JWT signature ourselves.
//
// No extra npm dependency is needed: Node's built-in crypto.createPublicKey
// accepts a JWK object directly (format: 'jwk'), so we can turn Apple's JWKS
// entries straight into a PEM for jsonwebtoken to verify against.
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const axios = require('axios');

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const KEYS_CACHE_MS = 6 * 60 * 60 * 1000; // Apple rotates keys infrequently

let _cachedKeys = null;
let _cachedAt = 0;

async function getApplePublicKeys() {
  const isFresh = _cachedKeys && (Date.now() - _cachedAt) < KEYS_CACHE_MS;
  if (isFresh) return _cachedKeys;

  const { data } = await axios.get(APPLE_KEYS_URL);
  _cachedKeys = data.keys || [];
  _cachedAt = Date.now();
  return _cachedKeys;
}

/**
 * Verifies an Apple identity token's signature, issuer, expiry, and audience.
 * @param {string} idToken
 * @param {string[]} validAudiences - accepted `aud` values (bundle ID / service ID)
 * @returns {Promise<{sub: string, email?: string, email_verified?: boolean, is_private_email?: boolean}>}
 * @throws if the token is malformed, expired, mis-signed, or has an unrecognized audience
 */
async function verifyAppleIdToken(idToken, validAudiences) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Malformed Apple identity token');

  const keys = await getApplePublicKeys();
  let jwk = keys.find((k) => k.kid === decoded.header.kid);
  if (!jwk) {
    // Key rotated since our last fetch — refresh once and retry.
    _cachedKeys = null;
    const freshKeys = await getApplePublicKeys();
    jwk = freshKeys.find((k) => k.kid === decoded.header.kid);
    if (!jwk) throw new Error('Unknown Apple signing key');
  }

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' });

  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: validAudiences,
  });

  return payload;
}

module.exports = { verifyAppleIdToken };
