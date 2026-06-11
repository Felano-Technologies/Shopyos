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

// ─── Engagement variant pools ─────────────────────────────────────────────────
// Returns an array of 4 copy variants for the given content type.
// The scheduler picks one per-user via deterministic hash — see pickVariant().

exports.getEngagementVariants = async (contentType, ctx = {}) => {
  const ai = getGenAI();

  if (!ai) {
    return variantFallback(contentType, ctx);
  }

  const prompt = buildVariantsPrompt(contentType, ctx);
  const modelsToTry = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite'
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      logger.info(`[Shopyos Marketing] Generating ${contentType} variants using: ${modelName}`);
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();

      const startIdx = raw.indexOf('[');
      const endIdx = raw.lastIndexOf(']');
      if (startIdx === -1 || endIdx === -1) throw new Error('No JSON array found in Gemini response');

      const parsed = JSON.parse(raw.slice(startIdx, endIdx + 1));
      const valid = (Array.isArray(parsed) ? parsed : [])
        .filter(v => v?.title && v?.message)
        .map(v => ({ title: String(v.title), message: String(v.message) }));

      if (!valid.length) throw new Error('No valid variants in Gemini response');

      logger.info(`[Shopyos Marketing] Generated ${valid.length} ${contentType} variants using: ${modelName}`);
      return valid;
    } catch (err) {
      logger.warn(`[Shopyos Marketing] Model ${modelName} failed for ${contentType} variants: ${err.message}`);
      lastError = err;
    }
  }

  logger.error('[Shopyos Marketing] All models failed for variants — using static fallback.', lastError);
  return variantFallback(contentType, ctx);
};

function buildVariantsPrompt(contentType, ctx) {
  const timeOfDay = ctx.timeOfDay || 'morning';

  const base = `You are a retention marketing specialist for "Shopyos", a premier E-Commerce Hub in Ghana.
Generate exactly 4 distinct push notification variants for a ${timeOfDay} campaign.
Each variant must have a short "title" (with relevant emojis, max 60 chars) and a "message" body (under 120 characters).
Make each variant meaningfully different in tone, angle, or CTA — not just rewording.
Return ONLY a valid JSON array: [{"title":"...","message":"..."},{"title":"...","message":"..."},{"title":"...","message":"..."},{"title":"...","message":"..."}]`;

  const instructions = {
    named_greeting: `Content type: personalised greeting.
Use the placeholder {{name}} naturally in EACH title (e.g. "Hey {{name}},", "Morning, {{name}}!", "{{name}}, rise and shine!").
Tone: warm and personal — like a message from a close friend, not a brand.
Vary the greeting style and CTA across variants (browse, discover, explore, shop local).`,

    generic_greeting: `Content type: general engagement greeting — no user name.
Tone: upbeat, energetic, enthusiastic.
Each variant takes a different angle: new arrivals, deals, local sellers, trending products.
CTAs vary: "browse now", "discover today", "shop local", "don't miss out".`,

    store_spotlight: `Content type: store discovery — spotlight a specific store.
Use the placeholder {{storeName}} naturally in each title or message body.
Angle varies: discovery, social proof ("shoppers love it"), local pride, exclusivity.
CTA varies: "go explore", "be among the first", "check it out", "discover their collection".`,

    product_spotlight: `Content type: product spotlight — build excitement around a specific item.
Use the placeholder {{productName}} naturally in each title.
Angle varies: trending/popular, back in stock, limited units, new arrival.
CTA varies: "grab yours", "don't miss it", "see it now", "order tonight".`,
  };

  return `${base}\n\n${instructions[contentType] || ''}`;
}

function variantFallback(contentType, ctx) {
  const timeOfDay = ctx.timeOfDay || 'morning';

  const pools = {
    named_greeting: {
      morning: [
        { title: 'Hey {{name}}, good morning! ☀️',        message: "Your favourite stores just restocked. Tap to see what's fresh on Shopyos today." },
        { title: 'Rise and shine, {{name}}! 🌅',           message: 'Fresh drops are waiting for you. Start your day with the best local finds on Shopyos.' },
        { title: 'Morning, {{name}}! 👋',                  message: "New arrivals just landed. Open Shopyos and see what's calling your name today." },
        { title: 'Good morning, {{name}}! ✨',              message: "Today's top picks are ready. Be first to grab what's trending on Shopyos." },
      ],
      afternoon: [
        { title: 'Afternoon, {{name}}! 🔥',                message: 'Hot deals are live right now. Take a quick break and shop local on Shopyos.' },
        { title: '{{name}}, midday check-in 👀',            message: "New products just dropped this afternoon. Don't let someone else grab your pick." },
        { title: 'Hey {{name}}, treat yourself 🎀',         message: "You've earned it. Great prices, trusted sellers — all waiting on Shopyos." },
        { title: '{{name}}, deals just for you 🛒',         message: 'Curated picks from local Ghanaian sellers are live. Tap to explore now.' },
      ],
      evening: [
        { title: 'Evening, {{name}}! 🌙',                  message: "Wind down with something special. Tonight's best picks are live on Shopyos." },
        { title: "{{name}}, you've earned this 🍷",         message: 'End your day right — explore new arrivals from trusted sellers on Shopyos.' },
        { title: 'Night mode on, {{name}}? 🌟',             message: "Perfect time to find something you'll love. Open Shopyos and browse tonight." },
        { title: 'Hey {{name}}, last call tonight ⏰',      message: "Some deals expire at midnight. Grab yours before they're gone on Shopyos." },
      ],
    },

    generic_greeting: {
      morning: [
        { title: 'Good morning! ☀️',                       message: "Start your day right — browse fresh deals on Shopyos and shop with one tap!" },
        { title: 'Rise & shop! 🌤️',                        message: 'Fresh products from local sellers are ready. What is your morning pick today?' },
        { title: 'New drops overnight 📦',                  message: 'While you slept, sellers added new items. Check them out before they sell out!' },
        { title: 'Beat the crowd 🏃',                       message: "Shop early and get the best picks before everyone else. Shopyos is open!" },
      ],
      afternoon: [
        { title: 'Midday deals 🔥',                         message: "Hot offers are live right now on Shopyos. Grab yours before they're gone!" },
        { title: 'Lunch break shopping 🛍️',                 message: 'Use your break wisely — new arrivals from trusted Ghanaian sellers just dropped.' },
        { title: 'Afternoon finds 🌟',                      message: 'Trendy styles, cool gadgets & daily must-haves — all live on Shopyos right now.' },
        { title: 'You deserve a treat 🎀',                  message: 'Halfway through the day — reward yourself with something nice from Shopyos.' },
      ],
      evening: [
        { title: 'Evening scrolling? 🌙',                   message: 'Relax and discover amazing products from trusted Ghanaian sellers tonight.' },
        { title: "Tonight's deals 🌟",                      message: "End your day on a high — check out tonight's exclusive offers on Shopyos." },
        { title: 'Night owl deals 🦉',                      message: 'Shopping at night just got better. Exclusive evening picks are live on Shopyos.' },
        { title: 'Order tonight, arrive tomorrow 📬',       message: 'Place your order now and wake up to a delivery. Fast shipping on Shopyos.' },
      ],
    },

    store_spotlight: {
      morning: [
        { title: 'A new store just dropped 🏪',             message: '{{storeName}} is now open on Shopyos — go explore their collection this morning.' },
        { title: 'Have you visited {{storeName}}? 👀',      message: 'They have amazing products worth checking out. Open Shopyos to browse.' },
        { title: '{{storeName}} is live on Shopyos ✨',     message: 'Discover fresh picks from this store. Tap to see what they have got today.' },
        { title: 'Support local this morning 🇬🇭',           message: '{{storeName}} and other Ghanaian sellers are ready for you. Shop on Shopyos!' },
      ],
      afternoon: [
        { title: 'Discover {{storeName}} 🏪',               message: 'A great store with fresh deals just for you. Check them out on Shopyos now.' },
        { title: 'New store alert! 🚨',                     message: '{{storeName}} just joined Shopyos. Be among the first to explore their products.' },
        { title: '{{storeName}} caught our eye 👁️',         message: 'Great products, great prices — see what the buzz is about this afternoon.' },
        { title: 'Fresh store, fresh deals 🛍️',             message: '{{storeName}} has something new waiting for you. Tap to browse their collection.' },
      ],
      evening: [
        { title: '{{storeName}} is trending tonight 🌙',    message: 'Shoppers love this store. Join them and explore the collection on Shopyos.' },
        { title: 'Before you sleep 🌟',                     message: 'Check out {{storeName}} on Shopyos — great finds you do not want to miss tonight.' },
        { title: 'Evening store pick 🏪',                   message: '{{storeName}} has fresh products ready for you. Wind down and browse tonight.' },
        { title: "Tonight's featured store ✨",              message: '{{storeName}} is our top pick tonight. Explore and find something you will love.' },
      ],
    },

    product_spotlight: {
      morning: [
        { title: '{{productName}} is trending 🔥',          message: "Don't miss it — shoppers are grabbing this one fast. Check it out on Shopyos." },
        { title: 'New arrival: {{productName}} ✨',          message: 'Just landed this morning. Be first to grab yours before it sells out!' },
        { title: '{{productName}} — morning pick 🛍️',       message: 'Highly rated, locally sourced. Tap to see why everyone is talking about this.' },
        { title: 'Hot this morning: {{productName}} ☀️',    message: 'Top-rated sellers just listed this. Open Shopyos and grab yours today.' },
      ],
      afternoon: [
        { title: '{{productName}} is selling fast ⚡',       message: 'High demand this afternoon. Grab yours before it is gone on Shopyos.' },
        { title: 'Afternoon deal: {{productName}} 🎯',       message: "Great price, great reviews — this one's worth checking out right now." },
        { title: '{{productName}} just restocked 📦',        message: 'Back in stock and ready to ship. Order on Shopyos before it sells out again.' },
        { title: "Today's pick: {{productName}} 🌟",         message: 'Curated by local sellers. Tap to see the full details and grab yours today.' },
      ],
      evening: [
        { title: "{{productName}} — tonight's find 🌙",     message: 'The perfect end-of-day discovery. Tap to see it on Shopyos before it is gone.' },
        { title: 'Last units: {{productName}} ⏰',           message: 'Only a few left in stock. Order tonight and wake up to a confirmation.' },
        { title: '{{productName}} is calling 📱',            message: 'Highly rated and ready to ship. Perfect evening browse on Shopyos.' },
        { title: "Don't sleep on {{productName}} 🌟",        message: 'Top sellers are moving this fast. Grab yours tonight before it sells out.' },
      ],
    },
  };

  const pool = pools[contentType]?.[timeOfDay] || pools.generic_greeting[timeOfDay] || pools.generic_greeting.morning;
  return pool;
}
