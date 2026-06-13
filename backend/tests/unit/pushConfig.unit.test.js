'use strict';

const { getChannelId, getTtlSeconds } = require('../../utils/pushConfig');

describe('pushConfig', () => {
  describe('getChannelId', () => {
    test('returns orders channel for order_ prefix', () => {
      expect(getChannelId('order_placed')).toBe('orders');
      expect(getChannelId('order_update')).toBe('orders');
    });

    test('returns orders channel for delivery_ prefix', () => {
      expect(getChannelId('delivery_assigned')).toBe('orders');
    });

    test('returns messages channel for new_message', () => {
      expect(getChannelId('new_message')).toBe('messages');
    });

    test('returns default channel for unknown event type', () => {
      expect(getChannelId('promotion_flash')).toBe('default');
      expect(getChannelId('unknown_event')).toBe('default');
    });

    test('returns default channel for null/undefined', () => {
      expect(getChannelId(null)).toBe('default');
      expect(getChannelId(undefined)).toBe('default');
    });

    test('is case-insensitive', () => {
      expect(getChannelId('ORDER_PLACED')).toBe('orders');
    });
  });

  describe('getTtlSeconds', () => {
    test('returns 86400 for order events', () => {
      expect(getTtlSeconds('order_placed')).toBe(86400);
    });

    test('returns 86400 for delivery events', () => {
      expect(getTtlSeconds('delivery_update')).toBe(86400);
    });

    test('returns 3600 for new_message', () => {
      expect(getTtlSeconds('new_message')).toBe(3600);
    });

    test('returns 604800 for promotion events', () => {
      expect(getTtlSeconds('promotion_sale')).toBe(604800);
    });

    test('returns default TTL for unknown event type', () => {
      expect(getTtlSeconds('unknown')).toBe(86400);
    });

    test('returns default TTL for null/undefined', () => {
      expect(getTtlSeconds(null)).toBe(86400);
      expect(getTtlSeconds(undefined)).toBe(86400);
    });
  });
});
