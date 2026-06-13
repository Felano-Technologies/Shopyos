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

  const SUPPORT_BOT_ID = '00000000-0000-0000-0000-000000000001';
  const modelsToTry = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite'
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      logger.info(`[Shopyos Bot] Attempting reply generation using model: ${modelName}`);
      const model = ai.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTIONS
      });

      // Format history for Gemini (roles must be 'user' or 'model')
      const formattedHistory = history.map(msg => ({
        role: msg.sender_id === SUPPORT_BOT_ID ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          maxOutputTokens: 1000, // Allow detailed and comprehensive replies
          thinkingConfig: {
            thinkingLevel: 'low'
          }
        }
      });

      const result = await chat.sendMessage([{ text: newMessage }]);
      let rawReply = result.response.text().trim();
      
      const isEscalation = rawReply.includes('[ESCALATE]');
      // Strip the escalation tag before showing it to the user
      const finalReply = rawReply.replaceAll('[ESCALATE]', '').trim();

      logger.info(`[Shopyos Bot] Successfully generated reply using model: ${modelName}`);
      return {
        reply: finalReply,
        isEscalation
      };
    } catch (err) {
      logger.warn(`[Shopyos Bot] Model ${modelName} failed or quota exceeded: ${err.message}`);
      lastError = err;
    }
  }

  // If we reach here, all tried models failed. Throw the error so the controller can send a graceful escalation response.
  logger.error('[Shopyos Bot] All Gemini models in fallback loop failed.', lastError);
  throw lastError || new Error('All Gemini models failed to generate a response');
};
