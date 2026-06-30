/**
 * Type-safe environment variable readers with defaults.
 * Centralizes all env var parsing to avoid scattered parseInt/isNaN checks.
 */

function envStr(key, defaultVal = '') {
  const val = process.env[key];
  return val !== undefined && val !== null ? String(val).trim() : defaultVal;
}

function envInt(key, defaultVal = 0) {
  const val = process.env[key];
  if (val === undefined || val === null || String(val).trim() === '') return defaultVal;
  const parsed = parseInt(String(val).trim(), 10);
  return Number.isFinite(parsed) ? parsed : defaultVal;
}

function envFloat(key, defaultVal = 0) {
  const val = process.env[key];
  if (val === undefined || val === null || String(val).trim() === '') return defaultVal;
  const parsed = parseFloat(String(val).trim());
  return Number.isFinite(parsed) ? parsed : defaultVal;
}

function envBool(key, defaultVal = false) {
  const val = process.env[key];
  if (val === undefined || val === null) return defaultVal;
  const str = String(val).trim().toLowerCase();
  return ['true', '1', 'yes', 'on', 'enabled'].includes(str);
}

module.exports = { envStr, envInt, envFloat, envBool };
