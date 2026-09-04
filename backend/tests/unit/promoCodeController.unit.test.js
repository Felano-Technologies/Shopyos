'use strict';

/**
 * tests/unit/promoCodeController.unit.test.js
 *
 * Unit tests for promoCodeController — seller/admin promo code creation
 * and management. Buyer-side redemption lives in promoController and is
 * tested separately.
 */

jest.mock('../../db/repositories', () => ({
  promoCodes: {
    create: jest.fn(),
    findByStore: jest.fn(),
    findAllAdmin: jest.fn(),
    findById: jest.fn(),
    deactivate: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  sellerCreatePromoCode,
  getSellerPromoCodes,
  adminCreatePromoCode,
  getAdminPromoCodes,
  deactivatePromoCode,
} = require('../../controllers/promoCodeController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'seller-user-id', roles: ['seller'], storeId: 'store-1' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PromoCodeController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sellerCreatePromoCode', () => {
    test('test_sellerCreatePromoCode_noStoreId_returns403', async () => {
      const req = mockReq({ user: { id: 'u1', roles: ['seller'], storeId: undefined } });
      const res = mockRes();

      await sellerCreatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(repositories.promoCodes.create).not.toHaveBeenCalled();
    });

    test('test_sellerCreatePromoCode_missingCode_returns400', async () => {
      const req = mockReq({ body: { type: 'percentage', value: 10 } });
      const res = mockRes();

      await sellerCreatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'code is required' }));
    });

    test('test_sellerCreatePromoCode_invalidType_returns400', async () => {
      const req = mockReq({ body: { code: 'SAVE10', type: 'bogus', value: 10 } });
      const res = mockRes();

      await sellerCreatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_sellerCreatePromoCode_percentageOver100_returns400', async () => {
      const req = mockReq({ body: { code: 'SAVE200', type: 'percentage', value: 200 } });
      const res = mockRes();

      await sellerCreatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('100') })
      );
    });

    test('test_sellerCreatePromoCode_expiresAtInPast_returns400', async () => {
      const req = mockReq({
        body: { code: 'SAVE10', type: 'percentage', value: 10, expiresAt: '2000-01-01T00:00:00.000Z' },
      });
      const res = mockRes();

      await sellerCreatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_sellerCreatePromoCode_validPayload_createsScopedToSellerStore', async () => {
      const created = { id: 'promo-1', code: 'SAVE10', store_id: 'store-1' };
      repositories.promoCodes.create.mockResolvedValueOnce(created);

      const req = mockReq({ body: { code: 'save10', type: 'percentage', value: 10, minOrder: '20', maxUses: '5' } });
      const res = mockRes();

      await sellerCreatePromoCode(req, res, jest.fn());

      expect(repositories.promoCodes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SAVE10',
          type: 'percentage',
          value: 10,
          min_order: 20,
          max_uses: 5,
          store_id: 'store-1',
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, promoCode: created }));
    });

    test('test_sellerCreatePromoCode_duplicateCode_returns400FriendlyMessage', async () => {
      const dup = new Error('duplicate key value violates unique constraint');
      dup.code = '23505';
      repositories.promoCodes.create.mockRejectedValueOnce(dup);

      const req = mockReq({ body: { code: 'SAVE10', type: 'percentage', value: 10 } });
      const res = mockRes();
      const next = jest.fn();

      await sellerCreatePromoCode(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'That code is already in use' }));
      expect(next).not.toHaveBeenCalled();
    });

    test('test_sellerCreatePromoCode_repositoryThrowsUnexpected_callsNext', async () => {
      const boom = new Error('db down');
      repositories.promoCodes.create.mockRejectedValueOnce(boom);

      const req = mockReq({ body: { code: 'SAVE10', type: 'percentage', value: 10 } });
      const res = mockRes();
      const next = jest.fn();

      await sellerCreatePromoCode(req, res, next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  describe('getSellerPromoCodes', () => {
    test('test_getSellerPromoCodes_noStoreId_returns403', async () => {
      const req = mockReq({ user: { id: 'u1', roles: ['seller'], storeId: undefined } });
      const res = mockRes();

      await getSellerPromoCodes(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('test_getSellerPromoCodes_returnsStoreCodes', async () => {
      const codes = [{ id: 'promo-1', store_id: 'store-1' }];
      repositories.promoCodes.findByStore.mockResolvedValueOnce(codes);

      const req = mockReq();
      const res = mockRes();

      await getSellerPromoCodes(req, res, jest.fn());

      expect(repositories.promoCodes.findByStore).toHaveBeenCalledWith('store-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: codes }));
    });
  });

  describe('adminCreatePromoCode', () => {
    test('test_adminCreatePromoCode_validPayload_createsPlatformWideCode', async () => {
      const created = { id: 'promo-2', code: 'WELCOME10', store_id: null };
      repositories.promoCodes.create.mockResolvedValueOnce(created);

      const req = mockReq({ user: { id: 'admin-1', roles: ['admin'] }, body: { code: 'WELCOME10', type: 'fixed', value: 5 } });
      const res = mockRes();

      await adminCreatePromoCode(req, res, jest.fn());

      expect(repositories.promoCodes.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'WELCOME10', store_id: null })
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('getAdminPromoCodes', () => {
    test('test_getAdminPromoCodes_noFilters_listsAll', async () => {
      repositories.promoCodes.findAllAdmin.mockResolvedValueOnce([]);
      const req = mockReq({ user: { id: 'admin-1', roles: ['admin'] } });
      const res = mockRes();

      await getAdminPromoCodes(req, res, jest.fn());

      expect(repositories.promoCodes.findAllAdmin).toHaveBeenCalledWith({ storeId: undefined, isActive: undefined });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getAdminPromoCodes_isActiveFalse_passesBooleanThrough', async () => {
      repositories.promoCodes.findAllAdmin.mockResolvedValueOnce([]);
      const req = mockReq({ user: { id: 'admin-1', roles: ['admin'] }, query: { isActive: 'false' } });
      const res = mockRes();

      await getAdminPromoCodes(req, res, jest.fn());

      expect(repositories.promoCodes.findAllAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
    });
  });

  describe('deactivatePromoCode', () => {
    test('test_deactivatePromoCode_codeNotFound_returns404', async () => {
      repositories.promoCodes.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ghost' } });
      const res = mockRes();

      await deactivatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_deactivatePromoCode_sellerNotOwner_returns403', async () => {
      repositories.promoCodes.findById.mockResolvedValueOnce({ id: 'promo-1', store_id: 'store-OTHER' });
      const req = mockReq({ params: { id: 'promo-1' } }); // user.storeId = 'store-1'
      const res = mockRes();

      await deactivatePromoCode(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(repositories.promoCodes.deactivate).not.toHaveBeenCalled();
    });

    test('test_deactivatePromoCode_sellerOwnsCode_deactivates', async () => {
      repositories.promoCodes.findById.mockResolvedValueOnce({ id: 'promo-1', store_id: 'store-1' });
      repositories.promoCodes.deactivate.mockResolvedValueOnce({ id: 'promo-1', is_active: false });
      const req = mockReq({ params: { id: 'promo-1' } });
      const res = mockRes();

      await deactivatePromoCode(req, res, jest.fn());

      expect(repositories.promoCodes.deactivate).toHaveBeenCalledWith('promo-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_deactivatePromoCode_adminDeactivatesAnyStoresCode_succeeds', async () => {
      repositories.promoCodes.findById.mockResolvedValueOnce({ id: 'promo-1', store_id: 'store-OTHER' });
      repositories.promoCodes.deactivate.mockResolvedValueOnce({ id: 'promo-1', is_active: false });
      const req = mockReq({ user: { id: 'admin-1', roles: ['admin'] }, params: { id: 'promo-1' } });
      const res = mockRes();

      await deactivatePromoCode(req, res, jest.fn());

      expect(repositories.promoCodes.deactivate).toHaveBeenCalledWith('promo-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
