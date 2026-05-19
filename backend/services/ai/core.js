// services/ai/core.js
const { logger } = require('../../config/logger');

let genAI = null;

const getGenAI = () => {
  if (genAI) return genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const { GoogleGenAI } = require('@google/generative-ai');
    genAI = new GoogleGenAI({ apiKey: key });
  } catch (e) {
    logger.warn('Failed to initialize GoogleGenAI SDK — is @google/generative-ai installed?', e.message);
  }
  return genAI;
};

module.exports = { getGenAI };
