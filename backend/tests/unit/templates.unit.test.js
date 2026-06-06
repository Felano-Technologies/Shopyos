'use strict';

/**
 * tests/unit/templates.unit.test.js
 *
 * Pure unit tests for the email/SMS template helpers.
 * No network, no DB, no external services.
 * Conforms to guidelines/test.md.
 */

const { getWelcomeTemplates, getOrderCreatedTemplates } = require('../../templates');

describe('Templates Unit Tests', () => {
  // ── getWelcomeTemplates ─────────────────────────────────────────────
  describe('getWelcomeTemplates', () => {
    test('test_getWelcomeTemplates_buyerRole_returnsCorrectEmailSubject', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('buyer', 'Jane Doe', '+233123456789');
      // Assert
      expect(result.email.subject).toBe('Welcome to Shopyos! 🎉');
    });

    test('test_getWelcomeTemplates_buyerRole_returnsEmailHtmlWithUserName', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('buyer', 'Jane Doe', '+233123456789');
      // Assert
      expect(result.email.html).toContain('Jane Doe');
    });

    test('test_getWelcomeTemplates_buyerRole_returnsSmsWithUserName', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('buyer', 'Jane Doe', '+233123456789');
      // Assert
      expect(result.sms).toContain('Jane Doe');
    });

    test('test_getWelcomeTemplates_sellerRole_returnsCorrectEmailSubject', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('seller', 'Store Owner', '+233987654321');
      // Assert
      expect(result.email.subject).toBe('Welcome to Shopyos — Start Selling!');
    });

    test('test_getWelcomeTemplates_sellerRole_returnsSmsMentioningListingProducts', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('seller', 'Store Owner', '+233987654321');
      // Assert
      expect(result.sms).toMatch(/list|product|sell/i);
    });

    test('test_getWelcomeTemplates_driverRole_returnsCorrectEmailSubject', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('driver', 'Driver Dan', '+233111222333');
      // Assert
      expect(result.email.subject).toBe('Welcome to Shopyos Drivers!');
    });

    test('test_getWelcomeTemplates_driverRole_returnsSmsWithDriverName', () => {
      // Arrange & Act
      const result = getWelcomeTemplates('driver', 'Driver Dan', '+233111222333');
      // Assert
      expect(result.sms).toContain('Driver Dan');
    });
  });

  // ── getOrderCreatedTemplates ────────────────────────────────────────
  describe('getOrderCreatedTemplates', () => {
    const orderData = {
      orderId: 'ORD-1234',
      amount: '150.00',
      customerName: 'John Mensah',
      itemsCount: 2,
    };

    test('test_getOrderCreatedTemplates_buyerRole_returnsEmailHtmlWithOrderAmount', () => {
      // Arrange & Act
      const result = getOrderCreatedTemplates('buyer', orderData);
      // Assert
      expect(result.email.html).toContain('150.00');
    });

    test('test_getOrderCreatedTemplates_buyerRole_returnsEmailHtmlWithOrderId', () => {
      // Arrange & Act
      const result = getOrderCreatedTemplates('buyer', orderData);
      // Assert
      expect(result.email.html).toContain('ORD-1234');
    });

    test('test_getOrderCreatedTemplates_buyerRole_returnsSmsWithOrderId', () => {
      // Arrange & Act
      const result = getOrderCreatedTemplates('buyer', orderData);
      // Assert
      expect(result.sms).toContain('ORD-1234');
    });

    test('test_getOrderCreatedTemplates_buyerRole_returnsSmsWithAmount', () => {
      // Arrange & Act
      const result = getOrderCreatedTemplates('buyer', orderData);
      // Assert
      expect(result.sms).toContain('150.00');
    });

    test('test_getOrderCreatedTemplates_sellerRole_returnsEmailHtmlWithOrderId', () => {
      // Arrange & Act
      const result = getOrderCreatedTemplates('seller', orderData);
      // Assert
      expect(result.email.html).toContain('ORD-1234');
    });

    test('test_getOrderCreatedTemplates_sellerRole_returnsEmailSubject', () => {
      // Arrange & Act
      const result = getOrderCreatedTemplates('seller', orderData);
      // Assert
      expect(result.email.subject).toBeTruthy();
    });
  });
});
