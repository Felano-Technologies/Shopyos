// services/callMessageService.js
// Calls and chat conversations are otherwise two entirely disjoint systems —
// this is the only place that connects them: after a call resolves (ended,
// missed, or rejected), it drops a `message_type: 'call'` row into the
// caller/receiver's conversation, exactly like a normal chat message, so the
// call shows up inline in their message history (mirrors how WhatsApp/
// iMessage show call history in-thread).
//
// Fire-and-forget from callController.js — a failure here must never affect
// the call's own lifecycle, which has already succeeded (accepted/rejected/
// ended) by the time this runs. All errors are swallowed internally.

const repositories = require('../db/repositories');
const { publishRealtimeEvent } = require('./realtimePublisher');
const { resolveImageUrl } = require('../config/storage');
const { logger } = require('../config/logger');

const emitToConversation = (conversationId, event, payload) =>
  publishRealtimeEvent({ scope: 'conversation', conversationId, event, payload });

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function callSummaryText(outcome, durationSeconds) {
  switch (outcome) {
    case 'completed': return `Call · ${formatDuration(durationSeconds)}`;
    case 'missed': return 'Missed call';
    case 'rejected': return 'Declined call';
    case 'cancelled': return 'Cancelled call';
    default: return 'Call';
  }
}

async function recordCallMessage({ callId, callerId, receiverId, outcome, durationSeconds = 0 }) {
  try {
    const conversation = await repositories.conversations.getOrCreateConversation(callerId, receiverId);

    const message = await repositories.messages.sendMessage({
      conversationId: conversation.id,
      senderId: callerId,
      content: callSummaryText(outcome, durationSeconds),
      messageType: 'call',
      attachmentMeta: { callId, outcome, durationSeconds, callerId, receiverId },
    });

    await repositories.conversations.updateLastActivity(conversation.id);

    const { data: messageWithSender } = await repositories.messages.db
      .from('messages')
      .select(`*, sender:sender_id ( id, user_profiles (full_name, avatar_url) )`)
      .eq('id', message.id)
      .single();

    const fullMessage = messageWithSender || message;
    const avatarUrl = fullMessage?.sender?.user_profiles?.avatar_url;
    if (avatarUrl) fullMessage.sender.user_profiles.avatar_url = await resolveImageUrl(avatarUrl);

    emitToConversation(conversation.id, 'message:new', { message: fullMessage, conversationId: conversation.id });
  } catch (err) {
    logger.error('[Calls] Failed to record call as a chat message', { callId, outcome, error: err.message });
  }
}

module.exports = { recordCallMessage };
