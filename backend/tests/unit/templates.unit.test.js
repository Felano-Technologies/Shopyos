'use strict';

/**
 * tests/unit/templates.unit.test.js
 *
 * Pure unit tests for the email/SMS template helpers.
 * No network, no DB, no external services.
 */

const { getWelcomeTemplates, getOrderCreatedTemplates } = require('../../templates');

describe('getWelcomeTemplates', () => {
  describe('buyer role', () => {
    const result = getWelcomeTemplates('buyer', 'Jane Doe', '+233123456789');

    test('email subject is correct', () => {
      expect(result.email.subject).toBe('Welcome to Shopyos!');
    });

    test('email HTML contains user name', () => {
      expect(result.email.html).toContain('Jane Doe');
    });

    test('SMS contains user name', () => {
      expect(result.sms).toContain('Jane Doe');
    });
  });

  describe('seller role', () => {
    const result = getWelcomeTemplates('seller', 'Store Owner', '+233987654321');

    test('email subject is correct', () => {
      expect(result.email.subject).toBe('Welcome to Shopyos!');
    });

    test('SMS mentions listing products', () => {
      expect(result.sms).toMatch(/list|product|sell/i);
    });
  });

  describe('driver role', () => {
    const result = getWelcomeTemplates('driver', 'Driver Dan', '+233111222333');

    test('email subject is correct', () => {
      expect(result.email.subject).toBe('Welcome to Shopyos!');
    });

    test('SMS contains driver name', () => {
      expect(result.sms).toContain('Driver Dan');
    });
  });
});

describe('getOrderCreatedTemplates', () => {
  const orderData = {
    orderId: 'ORD-1234',
    amount: '150.00',
    customerName: 'John Mensah',
    itemsCount: 2,
  };

  describe('buyer role', () => {
    const result = getOrderCreatedTemplates('buyer', orderData);

    test('email HTML contains order amount', () => {
      expect(result.email.html).toContain('150.00');
    });

    test('email HTML contains order ID', () => {
      expect(result.email.html).toContain('ORD-1234');
    });

    test('SMS contains order ID', () => {
      expect(result.sms).toContain('ORD-1234');
    });

    test('SMS contains amount', () => {
      expect(result.sms).toContain('150.00');
    });
  });

  describe('seller role', () => {
    const result = getOrderCreatedTemplates('seller', orderData);

    test('email HTML contains order ID', () => {
      expect(result.email.html).toContain('ORD-1234');
    });

    test('email subject exists', () => {
      expect(result.email.subject).toBeTruthy();
    });
  });
});
