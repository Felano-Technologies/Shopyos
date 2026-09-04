'use strict';

/**
 * tests/unit/promoController.unit.test.js
 *
 * Unit tests for the buyer-facing promo code validation endpoint,
 * including the store-scoping check (a store-scoped code should only
 * validate when the buyer's cart actually has an item from that store).
 */

const mockPoolQuery = jest.fn();
jest.mock('../../config/postgres', () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

jest.mock('../../db/repositories', () => ({
  carts: {
    getCartWithItems: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const { validatePromoCode } = require('../../controllers/promoController');

function mockReq(overrides = {}) {
  return {
    body: {},
    user: { id: 'buyer-1' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const platformWidePromo = {
  id: 'promo-1', code: 'SAVE10', type: 'percentage', value: 10,
  min_order: 0, max_uses: null, uses_count: 0, expires_at: null, store_id: null,
};

const storeScopedPromo = {
  ...platformWidePromo, id: 'promo-2', code: 'STOREA10', store_id: 'store-A',
};

describe('PromoController Unit Tests — validatePromoCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('test_validatePromoCode_missingFields_returns400', async () => {
    const req = mockReq({ body: { code: 'X' } });
    const res = mockRes();

    await validatePromoCode(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('test_validatePromoCode_codeNotFound_returns404', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });
    const req = mockReq({ body: { code: 'GHOST', subtotal: 100 } });
    const res = mockRes();

    await validatePromoCode(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('test_validatePromoCode_platformWideCode_neverChecksCart', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [platformWidePromo] }) // promo lookup
      .mockResolvedValueOnce({ rows: [] }); // promo_code_uses lookup
    const req = mockReq({ body: { code: 'save10', subtotal: 100 } });
    const res = mockRes();

    await validatePromoCode(req, res, jest.fn());

    expect(repositories.carts.getCartWithItems).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ promo: expect.objectContaining({ discountAmount: 10 }) }) })
    );
  });

  test('test_validatePromoCode_storeScoped_cartHasNoItemFromThatStore_returns400', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [storeScopedPromo] });
    repositories.carts.getCartWithItems.mockResolvedValueOnce({
      cart_items: [{ products: { store_id: 'store-B' } }],
    });
    const req = mockReq({ body: { code: 'STOREA10', subtotal: 100 } });
    const res = mockRes();

    await validatePromoCode(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'This code is only valid for items from that store' })
    );
  });

  test('test_validatePromoCode_storeScoped_cartHasItemFromThatStore_succeeds', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [storeScopedPromo] })
      .mockResolvedValueOnce({ rows: [] });
    repositories.carts.getCartWithItems.mockResolvedValueOnce({
      cart_items: [{ products: { store_id: 'store-A' } }],
    });
    const req = mockReq({ body: { code: 'STOREA10', subtotal: 100 } });
    const res = mockRes();

    await validatePromoCode(req, res, jest.fn());

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
