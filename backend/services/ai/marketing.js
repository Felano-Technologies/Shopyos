// services/ai/marketing.js
// Generates notification copy using Google Gemini AI.
// Falls back to quality static templates if GEMINI_API_KEY is not set.

const { logger } = require('../../config/logger');
const { getGenAI } = require('./core');

exports.generateNotificationText = async (promptType, ctx = {}) => {
  const ai = getGenAI();

  if (!ai) {
    logger.warn('GEMINI_API_KEY not set — using static fallback copy.');
    return fallback(promptType, ctx);
  }

  const prompt = buildPrompt(promptType, ctx);
  const modelsToTry = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite'
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      logger.info(`[Shopyos Marketing] Attempting content generation using model: ${modelName}`);
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: prompt,
        generationConfig: {
          thinkingConfig: {
            thinkingLevel: 'low'
          }
        }
      });
      const raw = result.response.text().trim();

      // Extract the first JSON object from the response
      const match = raw.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error('No JSON object found in Gemini response');

      const parsed = JSON.parse(match[0]);
      if (!parsed.title || !parsed.message) throw new Error('Incomplete JSON from Gemini');

      logger.info(`[Shopyos Marketing] Successfully generated notification using model: ${modelName}`);
      return { title: String(parsed.title), message: String(parsed.message) };
    } catch (err) {
      logger.warn(`[Shopyos Marketing] Model ${modelName} failed or quota exceeded: ${err.message}`);
      lastError = err;
    }
  }

  logger.error('[Shopyos Marketing] All Gemini models in fallback loop failed, calling static template fallback.', lastError);
  return fallback(promptType, ctx);
};

// ─── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(type, ctx) {
  if (type === 'holiday') {
    return `
You are a creative marketing manager for "Shopyos", an innovative E-Commerce Hub
connecting buyers and sellers of fashion, electronics, gadgets, and everyday essentials in Ghana.

Today is a public holiday in Ghana: "${ctx.holidayName || 'Public Holiday'}".

Write a warm, celebratory push notification / SMS for this holiday.
Requirements:
- Feel genuine and culturally Ghanaian (use local warmth, not generic phrases)
- Include relevant celebratory or shopping emojis in the title
- The message body must be under 130 characters
- Do NOT mention specific prices or promotions — keep it celebratory
- Return ONLY valid JSON in this exact shape:
{"title": "<short catchy title>", "message": "<body text>"}
`.trim();
  }

  // 'engagement'
  return `
You are a retention marketing specialist for "Shopyos", a premier E-Commerce Hub in Ghana.

Write a friendly, energetic ${ctx.timeOfDay || 'morning'} push notification to re-engage customers and encourage them
to open the app to discover new products, fashion, gadgets, or daily deals from local sellers.
Requirements:
- High energy, personal feel — like a message from a friend
- Include shopping/lifestyle emojis in the title (🛍️, 📱, ✨, 👟)
- Message body must be under 120 characters
- Subtle call-to-action (e.g., "Check today's deals", "Discover new arrivals", "Shop local sellers")
- Return ONLY valid JSON in this exact shape:
{"title": "<short catchy title>", "message": "<body text>"}
`.trim();
}

// ─── Static fallbacks ────────────────────────────────────────────────────────

function fallback(type, ctx) {
  if (type === 'holiday') {
    const name = ctx.holidayName || 'the Public Holiday';
    return {
      title: `Happy ${name}! 🎉`,
      message: `Shopyos wishes you a joyful ${name}. Relax — we've got your deliveries covered today!`
    };
  }
  const isMorning = ctx.timeOfDay !== 'evening';
  const hooks = isMorning ? [
    { title: 'Good morning! ☀️', message: 'Start your day right — browse fresh deals on Shopyos and shop with one tap!' },
    { title: 'New Arrivals 🛍️',      message: 'Your favourite stores just restocked. Discover fashion, gadgets & more on Shopyos.' },
    { title: 'Deals waiting! 🎁', message: 'Exclusive daily offers are live on the Shopyos hub. Don\'t miss out — shop now!' }
  ] : [
    { title: 'Evening scrolling? 🌙', message: 'Relax and discover amazing products from trusted Ghanaian sellers tonight on Shopyos.' },
    { title: 'Midnight cravings? 🛒', message: 'Shop late-night flash deals and get them delivered tomorrow!' },
    { title: 'Treat yourself 🍷', message: 'You worked hard today. Explore new fashion and gadgets on Shopyos.' }
  ];
  return hooks[new Date().getDay() % hooks.length];
}
