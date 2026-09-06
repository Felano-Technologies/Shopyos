// controllers/callController.js
// In-app calling: authorization, Agora RTC token minting, call lifecycle,
// recording upload.
//
// Component responsibilities (deliberately explicit, not "client-side
// recording" alone):
//   - Agora RTC:        live audio transport between the two participants.
//   - Client recording: each device records the call locally during the
//                        call (mixed local+remote audio) using Agora's
//                        recording API in the RTC SDK.
//   - Railway storage:  the durable home for the finished recording file —
//                        the client uploads to uploadCallRecording below
//                        once the call ends, asynchronously and retryably
//                        (a failed upload keeps the local file and retries
//                        later; this endpoint is idempotent per call).
//
// The server never trusts a client-reported call duration — started_at/
// ended_at/duration_seconds are all stamped from server clock time in
// acceptCall/endCallInternal, not from anything the app sends.
//
// Replaces the old tel: dialer hand-off so calls stay in-app, are logged,
// and are auditable by admins.

const crypto = require('crypto');
const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const { generateRtcToken } = require('../utils/agora');
const { uploadImage, resolveImageUrl, transformImageUrlsAsync } = require('../config/storage');
const { publishRealtimeEvent } = require('../services/realtimePublisher');
const { logger } = require('../config/logger');

const CALL_DURATION_SECONDS = 30;
const RING_TIMEOUT_SECONDS = 30;

const emitToUser = (userId, event, payload) =>
  publishRealtimeEvent({ scope: 'user', userId, event, payload });

// Timers are process-local — fine for Railway's single backend instance.
// A restart mid-call simply lets the call run without a server-side cutoff
// until the next `end` request; the DB row still reflects the true outcome.
const pendingTimers = new Map();

function clearPendingTimer(callId) {
  const timer = pendingTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(callId);
  }
}

function displayName(user) {
  const profile = Array.isArray(user?.user_profiles) ? user.user_profiles[0] : user?.user_profiles;
  return profile?.full_name || user?.email?.split('@')[0] || 'User';
}

// Fetches a user's display name + avatar (presigned URL) for the incoming-call
// push and the outgoing-call response, so both sides see who they're calling.
// NOTE: the custom pg-shim client (db/adapters/supabaseLikePgClient.js) does
// NOT support embedding user_profiles onto a plain `users` select — its
// per-table join shim (_shimUsers) only ever attaches user_roles — so the
// profile has to be fetched as a separate query instead of `users.findOne`
// with an embedded `user_profiles(...)` select (which silently comes back
// undefined).
async function getUserDisplayInfo(userId) {
  const user = await repositories.users.findById(userId);
  if (!user) return null;
  const profile = await repositories.userProfiles.findByUserId(userId);
  const transformed = await transformImageUrlsAsync({ ...user, user_profiles: profile });
  return { id: transformed.id, isActive: transformed.is_active, name: displayName(transformed), avatarUrl: transformed.user_profiles?.avatar_url || null };
}

// Role pairs allowed to call each other, independent of any specific order —
// a buyer can call any store, driver, etc. at any time, not just during an
// active order. Admin may call anyone unconditionally (checked separately).
const ALLOWED_ROLE_PAIRS = [
  ['buyer', 'seller'],
  ['buyer', 'driver'],
  ['seller', 'driver'],
];

function extractRoleNames(userWithRoles) {
  return (userWithRoles?.user_roles || [])
    .filter((ur) => ur.is_active)
    .map((ur) => (ur.roles || ur.role)?.name)
    .filter(Boolean);
}

// Determines whether callerId may call receiverId, based on their roles —
// no order relationship required (any buyer/seller/driver pairing is
// callable at any time).
async function canUsersCall(callerId, receiverId, orderId, callerRoles = []) {
  if (callerRoles.includes('admin')) return true;

  const receiverWithRoles = await repositories.users.getUserWithRoles(receiverId);
  if (!receiverWithRoles) return false;
  const receiverRoles = extractRoleNames(receiverWithRoles);
  if (receiverRoles.includes('admin')) return true;

  return ALLOWED_ROLE_PAIRS.some(
    ([a, b]) =>
      (callerRoles.includes(a) && receiverRoles.includes(b)) ||
      (callerRoles.includes(b) && receiverRoles.includes(a))
  );
}

// Server-authoritative end: duration is always computed here from the
// server's own started_at timestamp, never from anything a client sends.
async function endCallInternal(call, { endedBy, endReason }) {
  clearPendingTimer(call.id);

  const startedAt = call.started_at ? new Date(call.started_at) : null;
  const durationSeconds = startedAt ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)) : 0;

  const updates = {
    status: 'ended',
    ended_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    end_reason: endReason,
  };
  // A connected call is expected to produce a recording upload shortly after
  // this — recording_status stays 'pending' until uploadCallRecording lands
  // (or never arrives, which an admin reading 'pending' long after the call
  // should read as "no recording received").

  const updated = await repositories.calls.updateCall(call.id, updates);

  const otherUserId = endedBy === call.caller_id ? call.receiver_id : call.caller_id;
  emitToUser(otherUserId, 'call:ended', { callId: call.id, reason: endReason });

  return updated;
}

const initiateCall = async (req, res, next) => {
  try {
    const { receiverId, orderId } = req.body;
    const callerId = req.user.id;

    if (!receiverId) return ApiResponse.error(res, 'receiverId is required', 400);
    if (receiverId === callerId) return ApiResponse.error(res, 'Cannot call yourself', 400);

    const authorized = await canUsersCall(callerId, receiverId, orderId || null, req.user.roles || []);
    if (!authorized) return ApiResponse.error(res, 'You are not authorized to call this user', 403);

    const receiverInfo = await getUserDisplayInfo(receiverId);
    if (!receiverInfo || !receiverInfo.isActive) return ApiResponse.error(res, 'Receiver not found', 404);

    const channelName = `call_${crypto.randomUUID()}`;

    const call = await repositories.calls.createCall({
      order_id: orderId || null,
      caller_id: callerId,
      receiver_id: receiverId,
      agora_channel_name: channelName,
      status: 'ringing',
    });

    const { token, appId } = generateRtcToken(channelName, callerId, 'publisher');

    const callerInfo = await getUserDisplayInfo(callerId);
    emitToUser(receiverId, 'call:incoming', {
      callId: call.id,
      callerId,
      callerName: callerInfo?.name || 'Unknown caller',
      callerAvatar: callerInfo?.avatarUrl || null,
      orderId: orderId || null,
      channelName,
    });

    const timer = setTimeout(async () => {
      try {
        const current = await repositories.calls.findById(call.id);
        if (current && current.status === 'ringing') {
          await repositories.calls.updateCall(call.id, {
            status: 'missed',
            end_reason: 'missed',
            recording_status: 'not_recorded',
          });
          emitToUser(callerId, 'call:missed', { callId: call.id });
        }
      } catch (err) {
        logger.error('[Calls] Ring timeout handling failed', { callId: call.id, error: err.message });
      } finally {
        pendingTimers.delete(call.id);
      }
    }, RING_TIMEOUT_SECONDS * 1000);
    pendingTimers.set(call.id, timer);

    ApiResponse.withEntity(res, 'call', { id: call.id, channelName, token, appId, durationCapSeconds: CALL_DURATION_SECONDS, receiverAvatar: receiverInfo.avatarUrl || null }, 'Call initiated', null, 201);
  } catch (error) {
    next(error);
  }
};

const acceptCall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const call = await repositories.calls.findById(id);
    if (!call) return ApiResponse.error(res, 'Call not found', 404);
    if (call.receiver_id !== req.user.id) return ApiResponse.error(res, 'Not authorized to accept this call', 403);
    if (call.status !== 'ringing') return ApiResponse.error(res, `Call is no longer ringing (status: ${call.status})`, 400);

    clearPendingTimer(call.id);

    const startedAt = new Date().toISOString(); // server-authoritative call start
    const { token, appId } = generateRtcToken(call.agora_channel_name, req.user.id, 'publisher');

    const updated = await repositories.calls.updateCall(call.id, {
      status: 'accepted',
      started_at: startedAt,
    });

    emitToUser(call.caller_id, 'call:accepted', { callId: call.id, startedAt });

    // Server-side 30s cap — independent of whatever the client's own
    // countdown UI does, so a stalled/tampered client can't extend a call.
    const timer = setTimeout(() => {
      endCallInternal(updated, { endedBy: null, endReason: 'timeout_30s' })
        .catch((err) => logger.error('[Calls] 30s force-end failed', { callId: call.id, error: err.message }));
    }, CALL_DURATION_SECONDS * 1000);
    pendingTimers.set(call.id, timer);

    ApiResponse.withEntity(res, 'call', { id: call.id, channelName: call.agora_channel_name, token, appId, startedAt, durationCapSeconds: CALL_DURATION_SECONDS });
  } catch (error) {
    next(error);
  }
};

const rejectCall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const call = await repositories.calls.findById(id);
    if (!call) return ApiResponse.error(res, 'Call not found', 404);
    if (call.receiver_id !== req.user.id) return ApiResponse.error(res, 'Not authorized to reject this call', 403);
    if (call.status !== 'ringing') return ApiResponse.error(res, `Call is no longer ringing (status: ${call.status})`, 400);

    clearPendingTimer(call.id);
    await repositories.calls.updateCall(call.id, { status: 'rejected', end_reason: 'rejected', recording_status: 'not_recorded' });
    emitToUser(call.caller_id, 'call:rejected', { callId: call.id });

    ApiResponse.success(res, null, 'Call rejected');
  } catch (error) {
    next(error);
  }
};

const endCall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const call = await repositories.calls.findById(id);
    if (!call) return ApiResponse.error(res, 'Call not found', 404);
    if (call.caller_id !== req.user.id && call.receiver_id !== req.user.id) {
      return ApiResponse.error(res, 'Not authorized to end this call', 403);
    }
    if (['ended', 'rejected', 'missed', 'failed'].includes(call.status)) {
      return ApiResponse.success(res, { id: call.id, status: call.status }, 'Call already ended');
    }

    const endReason = req.user.id === call.caller_id ? 'caller_hangup' : 'receiver_hangup';
    const updated = await endCallInternal(call, { endedBy: req.user.id, endReason });

    ApiResponse.withEntity(res, 'call', updated, 'Call ended');
  } catch (error) {
    next(error);
  }
};

const getMyCalls = async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const calls = await repositories.calls.getCallsForUser(req.user.id, {
      limit: limit ? Number.parseInt(limit, 10) : 50,
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    ApiResponse.success(res, calls);
  } catch (error) {
    next(error);
  }
};

// ── Recording upload (client-side recording → Railway storage) ─────────────
// Either party may upload — whichever device's local recording completes and
// uploads first wins; this is deliberately idempotent so a retried/duplicate
// upload from the other party is a harmless no-op rather than an error, and
// so the client can safely retry after a network failure without special
// "already uploaded" handling on its end.
const uploadCallRecording = async (req, res, next) => {
  try {
    const { id } = req.params;
    const call = await repositories.calls.findById(id);
    if (!call) return ApiResponse.error(res, 'Call not found', 404);
    if (call.caller_id !== req.user.id && call.receiver_id !== req.user.id) {
      return ApiResponse.error(res, 'Not authorized to upload a recording for this call', 403);
    }
    if (!req.file) return ApiResponse.error(res, 'recording file is required', 400);

    if (call.recording_status === 'available') {
      // Already uploaded by the other party (or a prior retry) — idempotent success.
      const recordingUrl = call.recording_url ? await resolveImageUrl(call.recording_url) : null;
      return ApiResponse.withEntity(res, 'call', { id: call.id, recording_status: call.recording_status, recording_url: recordingUrl }, 'Recording already uploaded');
    }

    const uploaded = await uploadImage(req.file, 'call-recordings', {});
    const updated = await repositories.calls.updateCall(call.id, {
      recording_status: 'available',
      recording_url: uploaded.url, // storage key — resolved to a presigned URL on read
    });

    ApiResponse.withEntity(res, 'call', { id: updated.id, recording_status: updated.recording_status, recording_url: uploaded.public_url }, 'Recording uploaded');
  } catch (error) {
    logger.error('[Calls] Recording upload failed', { callId: req.params.id, error: error.message });
    try {
      await repositories.calls.updateCall(req.params.id, { recording_status: 'failed' });
    } catch (_) { /* best-effort */ }
    next(error);
  }
};

// ── Admin ────────────────────────────────────────────────────────────────────

const getAllCallsAdmin = async (req, res, next) => {
  try {
    const { status, from, to, limit, offset } = req.query;
    const calls = await repositories.calls.getAllCallsAdmin({
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: limit ? Number.parseInt(limit, 10) : 50,
      offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    const withResolvedRecordings = await Promise.all(
      calls.map(async (c) => (c.recording_url ? { ...c, recording_url: await resolveImageUrl(c.recording_url) } : c))
    );
    ApiResponse.success(res, withResolvedRecordings);
  } catch (error) {
    next(error);
  }
};

const getCallDetailsAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const call = await repositories.calls.getCallWithParticipants(id);
    if (!call) return ApiResponse.error(res, 'Call not found', 404);
    if (call.recording_url) call.recording_url = await resolveImageUrl(call.recording_url);
    ApiResponse.withEntity(res, 'call', call);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getMyCalls,
  uploadCallRecording,
  getAllCallsAdmin,
  getCallDetailsAdmin,
};
