/**
 * tests/globalTeardown.js
 * Runs once after the entire Jest test suite (in the main process).
 * Close any long-lived connections that survive between test files.
 */
module.exports = async () => {
  // Close postgres pool if it was initialised during integration tests
  try {
    const { getPool } = require('../config/postgres');
    const pool = getPool();
    if (pool) await pool.end();
  } catch {
    // Pool may not have been initialised (e.g. pure unit test run)
  }

  // Disconnect Redis if it was initialised
  try {
    const { disconnect } = require('../config/redis');
    await disconnect();
  } catch {
    // Redis may not have been initialised
  }
};
