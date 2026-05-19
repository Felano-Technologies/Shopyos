// services/ai/core.js
const { logger } = require('../../config/logger');

let genAI = null;

const getGenAI = () => {
  if (genAI) return genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(key);
  } catch (e) {
    logger.warn('Failed to initialize GoogleGenerativeAI SDK — is @google/generative-ai installed?', e.message);
  }
  return genAI;
};

module.exports = { getGenAI };
