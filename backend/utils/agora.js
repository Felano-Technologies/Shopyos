// utils/agora.js
// Agora RTC token minting for in-app calling.
//
// Architecture: Agora RTC carries the live audio; the client records the
// call locally and uploads the finished file to Railway storage afterward
// (see callController.js's uploadCallRecording) — Agora's own Cloud
// Recording product isn't used, since it can only write to its own fixed
// list of cloud vendors (AWS S3, Alibaba, Tencent, etc.), not Railway's
// bucket.

const { RtcTokenBuilder, RtcRole } = require('agora-token');

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour — a call is capped at 30s, this just avoids edge-of-expiry races

function assertConfigured() {
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    throw new Error('Agora is not configured: set AGORA_APP_ID and AGORA_APP_CERTIFICATE');
  }
}

// uid: a numeric Agora participant id. We derive a stable positive 31-bit int
// from the user's UUID so the same user always joins with the same uid.
function deriveNumericUid(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
}

function generateRtcToken(channelName, userId, role = 'publisher') {
  assertConfigured();
  const uid = deriveNumericUid(userId);
  const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = nowSeconds + TOKEN_TTL_SECONDS;

  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    rtcRole,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  return { token, uid, appId: AGORA_APP_ID };
}

module.exports = {
  deriveNumericUid,
  generateRtcToken,
};
