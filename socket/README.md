# Shopyos Socket Service

Dedicated realtime service for messaging, calls, notifications, and presence.

Requires PostgreSQL and Redis connectivity.

## Run

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   - `npm install`
3. Start:
   - `npm run dev`

## Modules

- `src/modules/messaging`: conversation join/leave, message send, read receipts
- `src/modules/calls`: call signaling events
- `src/modules/notifications`: realtime notification event relays
- `src/modules/presence`: online/offline and heartbeat

## External Event Bridge

The service subscribes to Redis pub/sub channel configured by `REALTIME_EVENTS_CHANNEL`.
Backend publishes events to this channel to fan out to connected users.
