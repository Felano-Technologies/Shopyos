// modules/calls/handlers.js
// In-app calling now uses Agora RTC (an SFU — clients connect to Agora's
// cloud via a minted token, not to each other via WebRTC offer/answer/ICE),
// so there is no media-signaling passthrough to register here anymore.
// The call lifecycle events (call:incoming/accepted/rejected/ended/missed)
// are triggered by the REST backend (backend/controllers/callController.js)
// and delivered to the right device via the existing Redis-bridged
// realtime path (publishRealtimeEvent → this service's realtimeSubscriber →
// emitToUser, scope 'user') rather than a socket-room broadcast — so no
// per-connection handlers are needed for that either.
//
// Kept as a no-op registrar (rather than deleting the module) so the
// require() in server.js/index.js doesn't need to change if it's still
// wired in; safe to remove entirely once confirmed unused.
const registerCallHandlers = () => {};

module.exports = { registerCallHandlers };
