// services/moderationService.js
const { logger } = require('../config/logger');

// Curated list of profane words/phrases to match against
const PROFANITY_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 
  'pussy', 'whore', 'slut', 'jackass', 'motherfuck', 'wanker', 
  'bullshit', 'dipshit', 'dumbass', 'nigger', 'faggot', 'retard', 'nigga',
  'cum'
];

// Curated list of partial/substring patterns for extra strict match (no word boundary required)
const STRICT_PROHIBITED_PATTERNS = [
  'fck', 'sht', 'btch', 'nigg', 'fag'
];

// Map of common bypass substitutions
const SUBSTITUTION_MAP = {
  '@': 'a', '4': 'a',
  '3': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't', '+': 't',
  '8': 'b',
  '9': 'g'
};

/**
 * Normalizes text to help detect bypass attempts (such as s.h.i.t or a$$hole)
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  let normalized = text.toLowerCase();

  // 1. Perform character substitutions (e.g. '@' -> 'a', '$' -> 's')
  let substituted = '';
  for (const char of normalized) {
    substituted += SUBSTITUTION_MAP[char] || char;
  }
  normalized = substituted;

  // 2. Remove all non-alphanumeric characters (to catch "s-h-i-t" or "s h i t")
  normalized = normalized.replace(/[^a-z0-9]/g, '');

  return normalized;
}

/**
 * Checks if a string contains profanity or inappropriate phrases.
 * @param {string} rawText
 * @returns {boolean}
 */
function containsProfanity(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;

  const textLower = rawText.toLowerCase();

  // Test 1: Check original text using word boundaries to avoid false positives (e.g. "class", "associate")
  for (const word of PROFANITY_WORDS) {
    const regex = new RegExp(String.raw`\b${word}\w*\b`, 'i');
    if (regex.test(textLower)) {
      logger.info(`[Moderation] Profanity detected via T1 (word boundary match): "${word}"`);
      return true;
    }
  }

  // Test 2: Check strict patterns (substring patterns where boundaries aren't strictly required)
  for (const pattern of STRICT_PROHIBITED_PATTERNS) {
    if (textLower.includes(pattern)) {
      logger.info(`[Moderation] Profanity detected via T2 (strict pattern match): "${pattern}"`);
      return true;
    }
  }

  // Test 3: Check normalized/de-spaced text (catches "s.h.i.t", "f u c k", "b_i_t_c_h")
  const normalizedText = normalizeText(rawText);
  for (const word of PROFANITY_WORDS) {
    if (normalizedText.includes(word)) {
      logger.info(`[Moderation] Profanity detected via T3 (normalized substring match): "${word}"`);
      return true;
    }
  }

  for (const pattern of STRICT_PROHIBITED_PATTERNS) {
    if (normalizedText.includes(pattern)) {
      logger.info(`[Moderation] Profanity detected via T3 (normalized strict pattern match): "${pattern}"`);
      return true;
    }
  }

  return false;
}

/**
 * Checks and moderates text, replacing the entire message if profanity is detected.
 * @param {string} text
 * @returns {{ isModerated: boolean, content: string }}
 */
function moderateText(text) {
  if (!text) {
    return { isModerated: false, content: '' };
  }

  const isProfane = containsProfanity(text);

  if (isProfane) {
    return {
      isModerated: true,
      content: 'This message has been flagged for containing sensitive or inappropriate language.'
    };
  }

  return {
    isModerated: false,
    content: text
  };
}

module.exports = {
  containsProfanity,
  moderateText
};
