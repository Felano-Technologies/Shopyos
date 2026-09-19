// services/ai/toolLogger.js
const { logger } = require('../../config/logger');
const repositories = require('../../db/repositories');

/**
 * Fire-and-forget audit log for an AI tool execution. Must never throw or
 * block the chat loop — a failure here should only ever produce a warning.
 * @param {{ userId: string, conversationId?: string, toolName: string, args: object, resultStatus: 'success'|'error' }} entry
 */
exports.logToolExecution = async ({ userId, conversationId, toolName, args, resultStatus }) => {
  try {
    await repositories.aiToolExecutions.create({
      user_id: userId,
      conversation_id: conversationId || null,
      tool_name: toolName,
      arguments: args || {},
      result_status: resultStatus
    });
  } catch (err) {
    logger.warn(`[Shopyos Bot] Failed to log tool execution for ${toolName}: ${err.message}`);
  }
};
