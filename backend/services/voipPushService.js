// services/voipPushService.js
// Sends native VoIP-wake pushes (APNs VoIP push on iOS, high-priority FCM
// data message on Android) so an incoming call can ring even when the app
// is backgrounded or fully killed. Expo's push relay (used for every other
// notification type — see expoPushService.js) doesn't support PushKit VoIP
// topics or guaranteed-wake high-priority data-only delivery, so this talks
// to APNs/FCM directly instead.
//
// Requires env config that isn't set by default:
//   APNS_AUTH_KEY                  - contents of the .p8 Auth Key file
//   APNS_KEY_ID                    - that key's Key ID (Apple Developer portal)
//   APNS_TEAM_ID                   - the Apple Developer Team ID
//   APNS_BUNDLE_ID                 - the app's bundle id (VoIP pushes go to `<bundleId>.voip`)
//   FIREBASE_SERVICE_ACCOUNT_JSON  - a Firebase service-account JSON, as a string
// Until these are set, sendVoipPush() logs a warning and no-ops rather than
// throwing — it must never block the existing (working) in-app call flow,
// which is why every call site wraps this in a try/catch.

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

let apnProvider;
function getApnProvider() {
  if (apnProvider !== undefined) return apnProvider;
  const { APNS_AUTH_KEY, APNS_KEY_ID, APNS_TEAM_ID } = process.env;
  if (!APNS_AUTH_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) {
    apnProvider = null;
    return apnProvider;
  }
  // eslint-disable-next-line global-require
  const apn = require('@parse/node-apn');
  apnProvider = new apn.Provider({
    token: { key: APNS_AUTH_KEY, keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID },
    production: process.env.NODE_ENV === 'production',
  });
  return apnProvider;
}

let firebaseApp;
function getFirebaseApp() {
  if (firebaseApp !== undefined) return firebaseApp;
  const { FIREBASE_SERVICE_ACCOUNT_JSON } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
    firebaseApp = null;
    return firebaseApp;
  }
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  firebaseApp = admin.apps.length
    ? admin.apps[0]
    : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) });
  return firebaseApp;
}

async function sendIosVoipPush(token, payload) {
  const provider = getApnProvider();
  if (!provider) {
    logger.warn('[VoipPush] APNs not configured — skipping iOS VoIP push. Set APNS_AUTH_KEY/APNS_KEY_ID/APNS_TEAM_ID/APNS_BUNDLE_ID.');
    return;
  }
  // eslint-disable-next-line global-require
  const apn = require('@parse/node-apn');
  const note = new apn.Notification();
  note.topic = `${process.env.APNS_BUNDLE_ID}.voip`;
  note.pushType = 'voip';
  note.payload = payload;
  note.expiry = Math.floor(Date.now() / 1000) + 25; // only useful within the ring window

  const result = await provider.send(note, token);
  if (result.failed?.length) {
    logger.error('[VoipPush] iOS VoIP push failed', { failures: result.failed.map((f) => f.response) });
  }
}

async function sendAndroidVoipPush(token, payload) {
  const app = getFirebaseApp();
  if (!app) {
    logger.warn('[VoipPush] Firebase not configured — skipping Android VoIP push. Set FIREBASE_SERVICE_ACCOUNT_JSON.');
    return;
  }
  // eslint-disable-next-line global-require
  const admin = require('firebase-admin');
  try {
    await admin.messaging(app).send({
      token,
      // FCM data messages require string values for every field.
      data: Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
    });
  } catch (err) {
    logger.error('[VoipPush] Android FCM push failed', { error: err.message });
  }
}

// payload must be plain string-able fields only (both APNs custom payloads
// and FCM data messages require string values) — callId/channelName/
// callerName/callerAvatar is enough for the native side to display the
// incoming call and for the JS side to know which call to accept/reject via
// the existing POST /calls/:id/accept|reject endpoints (no new call-answer
// logic needed server-side).
async function sendVoipPush(userId, payload) {
  const tokens = await repositories.notifications.getUserVoipPushTokens(userId);
  if (!tokens.length) return;

  await Promise.all(tokens.map((t) => (
    t.platform === 'ios' ? sendIosVoipPush(t.token, payload) : sendAndroidVoipPush(t.token, payload)
  )));
}

module.exports = { sendVoipPush };
