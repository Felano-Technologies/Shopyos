// services/holidayService.js
// Checks whether a given date is a public holiday in Ghana using the free Nager.Date API.
// No API key required. Fails gracefully if the API is unreachable.

const axios = require('axios');
const { logger } = require('../config/logger');

const NAGER_BASE = 'https://date.nager.at/api/v3';

// Simple in-process cache to avoid hitting the API more than once per day
let _cache = null; // { year, holidays: [{ date, localName, name }] }

/**
 * Fetch Ghana public holidays for the given year (cached per year).
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getHolidaysForYear(year) {
  if (_cache?.year === year) return _cache.holidays;

  try {
    const { data } = await axios.get(`${NAGER_BASE}/PublicHolidays/${year}/GH`, { timeout: 8000 });
    _cache = { year, holidays: data || [] };
    logger.info(`[HolidayService] Cached ${_cache.holidays.length} Ghana holidays for ${year}`);
    return _cache.holidays;
  } catch (err) {
    logger.error('[HolidayService] Failed to fetch holidays from Nager.Date:', err.message);
    return [];
  }
}

/**
 * Determine if a specific date (default: today) is a public holiday in Ghana.
 * @param {Date} [date]
 * @returns {Promise<{ localName: string, name: string } | null>}
 */
exports.checkIfHoliday = async (date = new Date()) => {
  const year = date.getFullYear();
  const todayStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

  const holidays = await getHolidaysForYear(year);
  const match = holidays.find(h => h.date === todayStr);

  if (match) {
    logger.info(`[HolidayService] Today (${todayStr}) is: ${match.localName} (${match.name})`);
    return { localName: match.localName, name: match.name };
  }

  return null;
};

/**
 * Fetch all upcoming Ghana public holidays for the rest of the current year.
 * Useful for displaying on the admin dashboard.
 * @returns {Promise<Array>}
 */
exports.getUpcomingHolidays = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const holidays = await getHolidaysForYear(now.getFullYear());
  return holidays.filter(h => h.date >= todayStr);
};
