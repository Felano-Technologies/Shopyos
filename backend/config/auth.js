const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

const ACCESS_TOKEN_BLACKLIST_PREFIX = 'shopyos:blacklist:access:';
const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'strict',
    path: '/'
};

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');

// Raw tokens are NEVER stored — only their SHA-256 hash
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_DAYS,
    REFRESH_TOKEN_EXPIRY_MS,
    ACCESS_TOKEN_BLACKLIST_PREFIX,
    ACCESS_TOKEN_MAX_AGE_SECONDS,
    COOKIE_OPTIONS,
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    generateRefreshToken,
    hashToken
};
