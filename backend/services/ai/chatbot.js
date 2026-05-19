// services/ai/chatbot.js
const { logger } = require('../../config/logger');
const { getGenAI } = require('./core');
const { SYSTEM_INSTRUCTIONS } = require('./knowledge');

/**
 * Generate a response for the Shopyos Support Bot.
 * @param {string} userId - ID of the user chatting
 * @param {string} newMessage - The latest message from the user
 * @param {Array} history - Array of { sender_id, content } objects (oldest to newest)
 * @returns {Promise<{ reply: string, isEscalation: boolean }>}
 */
exports.generateBotReply = async (userId, newMessage, history = []) => {
  const ai = getGenAI();

  if (!ai) {
    return {
      reply: "I am currently offline. Please contact human support at support@shopyos.com.",
      isEscalation: false
    };
  }

  try {
    const model = ai.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: SYSTEM_INSTRUCTIONS
    });

    // Format history for Gemini (roles must be 'user' or 'model')
    // We treat the Shopyos Bot's past replies as 'model', and the user's as 'user'.
    const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';
    
    const formattedHistory = history.map(msg => ({
      role: msg.sender_id === SUPPORT_BOT_ID ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 1000, // Allow detailed and comprehensive replies
      }
    });

    const result = await chat.sendMessage([{ text: newMessage }]);
    let rawReply = result.response.text().trim();
    
    const isEscalation = rawReply.includes('[ESCALATE]');
    // Strip the escalation tag before showing it to the user
    const finalReply = rawReply.replace(/\[ESCALATE\]/g, '').trim();

    return {
      reply: finalReply,
      isEscalation
    };

  } catch (err) {
    logger.error('[Shopyos Bot] Error generating reply:', err);
    return {
      reply: "I'm having a bit of trouble connecting right now. Let me pass you to a human agent. [ESCALATE]",
      isEscalation: true
    };
  }
};
