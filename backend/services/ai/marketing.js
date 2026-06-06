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
      // Pass prompt as a plain string — the SDK wraps it into the correct Content format.
      const result = await model.generateContent(prompt);
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
    const holidayHooks = [
      { title: `Happy ${name}! 🎉`,  message: `Shopyos wishes you a joyful ${name}. Relax — we've got your deliveries covered today!` },
      { title: `Enjoy the ${name} 🇬🇭`, message: `Wishing you a wonderful ${name} celebration! Shopyos is here whenever you need us.` },
      { title: `${name} vibes ✨`,     message: `Celebrate in style! Browse Shopyos for gifts, fashion & more this ${name}.` },
      { title: `It's ${name}! 🥳`,    message: `Take a break and enjoy the day. Shopyos will be right here when you're ready to shop.` },
    ];
    return holidayHooks[new Date().getDay() % holidayHooks.length];
  }
  const timeOfDay = ctx.timeOfDay || 'morning';
  const hooksByTime = {
    morning: [
      { title: 'Good morning! ☀️',        message: 'Start your day right — browse fresh deals on Shopyos and shop with one tap!' },
      { title: 'New Arrivals 🛍️',          message: 'Your favourite stores just restocked. Discover fashion, gadgets & more on Shopyos.' },
      { title: 'Deals waiting! 🎁',         message: 'Exclusive daily offers are live on the Shopyos hub. Don\'t miss out — shop now!' },
      { title: 'Rise & shop! 🌤️',           message: 'Good morning! Fresh products from local sellers are ready for you on Shopyos.' },
      { title: 'Your morning haul 👜',       message: 'Top picks handpicked for you. Tap to see what\'s trending this morning on Shopyos.' },
      { title: 'Fresh drops overnight 📦',   message: 'While you slept, sellers added new items. Check them out before they sell out!' },
      { title: 'Morning motivation 💪',      message: 'Treat yourself today — great products, great prices. Only on Shopyos.' },
      { title: 'Beat the crowd 🏃',          message: 'Shop early and get the best picks before everyone else. Shopyos is open!' },
      { title: 'Today\'s top finds ✨',       message: 'Discover what\'s hot this morning — fashion, tech & more from trusted Ghanaian sellers.' },
      { title: 'Start strong 🔥',            message: 'Great morning deals are waiting. Open Shopyos and grab yours before they\'re gone!' },
    ],
    afternoon: [
      { title: 'Afternoon pick-me-up 🛒',   message: 'Take a break and browse today\'s best deals on Shopyos — delivered to your door!' },
      { title: 'Midday deals 🔥',            message: 'Hot offers are live right now on Shopyos. Grab yours before they\'re gone!' },
      { title: 'Lunch break shopping 🛍️',   message: 'Use your break wisely — discover new arrivals from trusted Ghanaian sellers on Shopyos.' },
      { title: 'Flash deal alert ⚡',         message: 'Limited-time afternoon deals just dropped on Shopyos. Don\'t sleep on this!' },
      { title: 'You deserve a treat 🎀',     message: 'Halfway through the day — reward yourself with something nice from Shopyos.' },
      { title: 'Sellers near you 📍',         message: 'Local Ghanaian sellers have fresh stock this afternoon. Shop & support local!' },
      { title: 'Restock yourself 💡',         message: 'Running low on essentials? Shopyos has you covered. Order now, delivered fast.' },
      { title: 'Afternoon finds 🌟',          message: 'Trendy styles, cool gadgets & daily must-haves — all live on Shopyos right now.' },
      { title: 'Keep it moving 🚀',           message: 'Don\'t let the afternoon slow you down. Great deals are one tap away on Shopyos.' },
      { title: 'Mid-week motivation 🛒',      message: 'Push through the week with a little retail therapy. Check what\'s new on Shopyos!' },
    ],
    evening: [
      { title: 'Evening scrolling? 🌙',      message: 'Relax and discover amazing products from trusted Ghanaian sellers tonight on Shopyos.' },
      { title: 'Unwind & shop 🍷',            message: 'You worked hard today. Explore new fashion and gadgets on Shopyos.' },
      { title: 'Tonight\'s deals 🌟',         message: 'End your day on a high — check out tonight\'s exclusive offers on Shopyos.' },
      { title: 'Wind down & browse 🌅',       message: 'Evening is the perfect time to find something special. Open Shopyos and explore.' },
      { title: 'Night owl deals 🦉',           message: 'Shopping at night just got better. Exclusive evening picks are live on Shopyos.' },
      { title: 'Order tonight, arrive tomorrow 📬', message: 'Place your order now and wake up to a delivery. Fast shipping on Shopyos.' },
      { title: 'Your cart is waiting 🛒',     message: 'You left something behind! Finish your order tonight on Shopyos.' },
      { title: 'Evening essentials 🌙',        message: 'Stock up on what you need tonight. Trusted sellers, fast delivery on Shopyos.' },
      { title: 'Treat someone tonight 🎁',    message: 'Surprise a friend or loved one with a gift from Shopyos. Order now!' },
      { title: 'Last chance today ⏰',         message: 'Some of today\'s best deals expire at midnight. Grab them now on Shopyos.' },
    ]
  };
  const hooks = hooksByTime[timeOfDay] || hooksByTime.morning;
  return hooks[new Date().getDay() % hooks.length];
}
