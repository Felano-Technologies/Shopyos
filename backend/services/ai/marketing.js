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

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Extract the first JSON object from the response
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No JSON object found in Gemini response');

    const parsed = JSON.parse(match[0]);
    if (!parsed.title || !parsed.message) throw new Error('Incomplete JSON from Gemini');

    return { title: String(parsed.title), message: String(parsed.message) };
  } catch (err) {
    logger.error('Gemini AI generation error — using fallback:', err.message);
    return fallback(promptType, ctx);
  }
};

// ─── Prompt builder ─────────────────────────────────────────────────────────

function buildPrompt(type, ctx) {
  if (type === 'holiday') {
    return `
You are a creative marketing manager for "Shopyos", a fast-growing on-demand food, grocery,
and product delivery app serving customers across Ghana.

Today is a public holiday in Ghana: "${ctx.holidayName || 'Public Holiday'}".

Write a warm, celebratory push notification / SMS for this holiday.
Requirements:
- Feel genuine and culturally Ghanaian (use local warmth, not generic phrases)
- Include relevant emojis in the title
- The message body must be under 130 characters
- Do NOT mention specific prices or promotions — keep it celebratory
- Return ONLY valid JSON in this exact shape:
{"title": "<short catchy title>", "message": "<body text>"}
`.trim();
  }

  // 'engagement'
  return `
You are a retention marketing specialist for "Shopyos", an on-demand delivery app in Ghana.

Write a friendly, energetic morning push notification to re-engage customers and encourage them
to open the app and place an order today.
Requirements:
- High energy, personal feel — like a message from a friend
- Include food/shopping emojis in the title
- Message body must be under 120 characters
- Subtle call-to-action (e.g., "Check today's deals", "Order breakfast now")
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
  const hooks = [
    { title: 'Good morning! ☀️', message: 'Start your day right — browse fresh deals on Shopyos and order with one tap!' },
    { title: 'Hungry? 🍽️',      message: 'Your favourite stores are open. Order now and get it delivered fast with Shopyos.' },
    { title: 'Deals waiting! 🛍️', message: 'Exclusive daily offers are live on Shopyos. Don\'t miss out — shop now!' },
    { title: 'It\'s deal o\'clock ⚡', message: 'Flash offers just dropped on Shopyos. Tap to grab yours before they\'re gone!' },
    { title: 'Rise & order! 🌅', message: 'Morning sorted. Shopyos delivers breakfast, groceries & more right to your door.' }
  ];
  return hooks[new Date().getDay() % hooks.length];
}
