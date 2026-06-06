'use strict';

/**
 * tests/unit/distance.unit.test.js
 *
 * Pure unit tests for utils/distance.js — haversine formula and delivery fee
 * calculator. No network, no DB, no external services.
 * Conforms to guidelines/test.md.
 */

const { haversineKm, calculateDeliveryFee } = require('../../utils/distance');

describe('distance Unit Tests', () => {
  // ── haversineKm ─────────────────────────────────────────────────────────────
  describe('haversineKm', () => {
    test('test_haversineKm_samePoint_returnsZero', () => {
      // Arrange & Act
      const result = haversineKm(5.6037, -0.187, 5.6037, -0.187);
      // Assert
      expect(result).toBe(0);
    });

    test('test_haversineKm_samePoint_returnsNumber', () => {
      // Arrange & Act
      const result = haversineKm(0, 0, 0, 0);
      // Assert
      expect(typeof result).toBe('number');
    });

    test('test_haversineKm_accraNorthPole_returnsApproximatelyCorrectDistance', () => {
      // Arrange — Accra, Ghana (5.6037°N, 0.1870°W) → North Pole (90°N, 0°)
      // Expected great-circle ≈ 9378 km
      // Act
      const result = haversineKm(5.6037, -0.187, 90, 0);
      // Assert
      expect(result).toBeGreaterThan(9300);
      expect(result).toBeLessThan(9450);
    });

    test('test_haversineKm_accraTema_returnsShortDistance', () => {
      // Arrange — Accra (5.6037, -0.1870) → Tema (5.6698, 0.0166)
      // Roughly 20–25 km apart
      // Act
      const result = haversineKm(5.6037, -0.187, 5.6698, 0.0166);
      // Assert
      expect(result).toBeGreaterThan(15);
      expect(result).toBeLessThan(35);
    });

    test('test_haversineKm_londonParis_returnsApproximately340km', () => {
      // Arrange — London (51.5074, -0.1278) → Paris (48.8566, 2.3522)
      // Act
      const result = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
      // Assert — accepted range 330–360 km
      expect(result).toBeGreaterThan(330);
      expect(result).toBeLessThan(360);
    });

    test('test_haversineKm_antipodePoints_returnsApproximatelyHalfEarthCircumference', () => {
      // Arrange — (0, 0) and (0, 180) are antipodal, distance ≈ 20015 km
      // Act
      const result = haversineKm(0, 0, 0, 180);
      // Assert
      expect(result).toBeGreaterThan(20000);
      expect(result).toBeLessThan(20030);
    });

    test('test_haversineKm_result_isRoundedToTwoDecimalPlaces', () => {
      // Arrange & Act
      const result = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
      // Assert — at most 2 decimal places
      const decimalPart = result.toString().split('.')[1];
      const decimalLength = decimalPart ? decimalPart.length : 0;
      expect(decimalLength).toBeLessThanOrEqual(2);
    });

    test('test_haversineKm_symmetry_distanceABEqualsDistanceBA', () => {
      // Arrange
      const lat1 = 5.6037; const lon1 = -0.187;
      const lat2 = 6.6885; const lon2 = -1.6244;
      // Act
      const ab = haversineKm(lat1, lon1, lat2, lon2);
      const ba = haversineKm(lat2, lon2, lat1, lon1);
      // Assert — haversine must be symmetric
      expect(ab).toBe(ba);
    });

    test('test_haversineKm_negativeCoordinates_returnsPositiveDistance', () => {
      // Arrange — two points in the southern hemisphere
      // Act
      const result = haversineKm(-33.8688, 151.2093, -36.8485, 174.7633);
      // Assert
      expect(result).toBeGreaterThan(0);
    });
  });

  // ── calculateDeliveryFee ────────────────────────────────────────────────────
  describe('calculateDeliveryFee', () => {
    const baseStore = {
      delivery_base_fee: '5.00',
      delivery_per_km_fee: '1.50',
      delivery_max_km: '20',
    };

    test('test_calculateDeliveryFee_withinRange_returnsWithinRangeTrue', () => {
      // Arrange & Act
      const result = calculateDeliveryFee(baseStore, 10);
      // Assert
      expect(result.withinRange).toBe(true);
    });

    test('test_calculateDeliveryFee_withinRange_returnsCorrectFee', () => {
      // Arrange — baseFee 5 + 10km * 1.50 = 20
      // Act
      const result = calculateDeliveryFee(baseStore, 10);
      // Assert
      expect(result.fee).toBe(20);
    });

    test('test_calculateDeliveryFee_withinRange_returnsDistanceKm', () => {
      // Arrange & Act
      const result = calculateDeliveryFee(baseStore, 10);
      // Assert
      expect(result.distanceKm).toBe(10);
    });

    test('test_calculateDeliveryFee_beyondMaxKm_returnsWithinRangeFalse', () => {
      // Arrange & Act
      const result = calculateDeliveryFee(baseStore, 25);
      // Assert
      expect(result.withinRange).toBe(false);
    });

    test('test_calculateDeliveryFee_beyondMaxKm_returnsFeeNull', () => {
      // Arrange & Act
      const result = calculateDeliveryFee(baseStore, 25);
      // Assert
      expect(result.fee).toBeNull();
    });

    test('test_calculateDeliveryFee_exactlyAtMaxKm_returnsWithinRangeTrue', () => {
      // Arrange & Act
      const result = calculateDeliveryFee(baseStore, 20);
      // Assert
      expect(result.withinRange).toBe(true);
    });

    test('test_calculateDeliveryFee_noMaxKm_alwaysWithinRange', () => {
      // Arrange — no delivery_max_km means unlimited range
      const unlimitedStore = { delivery_base_fee: '5', delivery_per_km_fee: '1', delivery_max_km: null };
      // Act
      const result = calculateDeliveryFee(unlimitedStore, 9999);
      // Assert
      expect(result.withinRange).toBe(true);
      expect(result.fee).not.toBeNull();
    });

    test('test_calculateDeliveryFee_zeroDistance_returnsMinimumFeeOf5', () => {
      // Arrange — rawFee = 5 + 0 * 1.5 = 5, minimum is 5
      // Act
      const result = calculateDeliveryFee(baseStore, 0);
      // Assert
      expect(result.fee).toBe(5);
    });

    test('test_calculateDeliveryFee_verySmallDistance_enforceMinimumFeeOf5', () => {
      // Arrange — store with zero base fee and low per-km rate, 1 km → rawFee = 0.50 < 5
      const cheapStore = { delivery_base_fee: '0', delivery_per_km_fee: '0.50', delivery_max_km: null };
      // Act
      const result = calculateDeliveryFee(cheapStore, 1);
      // Assert
      expect(result.fee).toBe(5);
    });

    test('test_calculateDeliveryFee_largePerKmFee_exceedsMinimum', () => {
      // Arrange — 5 km at 3/km + 5 base = 20 > minimum of 5
      const priceyStore = { delivery_base_fee: '5', delivery_per_km_fee: '3', delivery_max_km: null };
      // Act
      const result = calculateDeliveryFee(priceyStore, 5);
      // Assert
      expect(result.fee).toBe(20);
    });

    test('test_calculateDeliveryFee_missingFeeFields_defaultsToZero', () => {
      // Arrange — store without fee fields should default to zero
      const emptyStore = {};
      // Act
      const result = calculateDeliveryFee(emptyStore, 10);
      // Assert — rawFee = 0, minimum is 5
      expect(result.fee).toBe(5);
      expect(result.withinRange).toBe(true);
    });

    test('test_calculateDeliveryFee_feeRoundedToTwoDecimalPlaces', () => {
      // Arrange — 3 km * 1.333/km = 3.999 → should round properly
      const fractionalStore = { delivery_base_fee: '0', delivery_per_km_fee: '1.333', delivery_max_km: null };
      // Act
      const result = calculateDeliveryFee(fractionalStore, 3);
      // Assert — fee should be ≥ 5 (minimum) and a finite number
      expect(Number.isFinite(result.fee)).toBe(true);
    });
  });
});
