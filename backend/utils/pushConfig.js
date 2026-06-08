// Shared push notification routing config
// Single source of truth for channelId and TTL used by both the worker and expoPushService

const CHANNEL_RULES = [
  { prefix: 'order',       channel: 'orders'   },
  { prefix: 'delivery',    channel: 'orders'   },
  { prefix: 'new_message', channel: 'messages' },
];

const TTL_RULES = [
  { prefix: 'order',       ttl: 86400  },  // 24 h — order updates go stale quickly
  { prefix: 'delivery',    ttl: 86400  },  // 24 h
  { prefix: 'new_message', ttl: 3600   },  // 1 h  — chat messages lose value fast
  { prefix: 'promotion',   ttl: 604800 },  // 7 d  — promos can wait
];

const DEFAULT_CHANNEL = 'default';
const DEFAULT_TTL     = 86400;

function matchPrefix(type, rules) {
  const lower = (type || '').toLowerCase();
  return rules.find(r => lower.startsWith(r.prefix)) || null;
}

function getChannelId(eventType) {
  const match = matchPrefix(eventType, CHANNEL_RULES);
  return match ? match.channel : DEFAULT_CHANNEL;
}

function getTtlSeconds(eventType) {
  const match = matchPrefix(eventType, TTL_RULES);
  return match ? match.ttl : DEFAULT_TTL;
}

module.exports = { getChannelId, getTtlSeconds };
