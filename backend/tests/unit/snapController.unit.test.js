'use strict';

/**
 * tests/unit/snapController.unit.test.js
 *
 * Unit tests for SnapController — no real DB, no HTTP server.
 * Mocks the postgres pool and storage helpers.
 * Conforms to guidelines/test.md.
 */

const mockDb = {
  query: jest.fn(),
};

jest.mock('../../config/postgres', () => ({
  getPool: jest.fn(() => mockDb),
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => url ? `http://mocked-public-url/${url}` : null),
}));

const snapController = require('../../controllers/snapController');
const storage = require('../../config/storage');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    store: { id: 'store-123' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('SnapController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createSnap ──────────────────────────────────────────────────────
  describe('createSnap', () => {
    test('test_createSnap_validInput_createsSnapAndReturns201Created', async () => {
      // Arrange
      const mockSnap = { id: 1, store_id: 'store-123', media_url: 'snap.jpg', caption: 'Test snap', product_id: 'prod-456' };
      mockDb.query.mockResolvedValueOnce({ rows: [mockSnap] });

      const req = mockReq({ body: { media_url: 'snap.jpg', caption: 'Test snap', product_id: 'prod-456' } });
      const res = mockRes();

      // Act
      await snapController.createSnap(req, res);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO snaps'),
        ['store-123', 'snap.jpg', 'Test snap', 'prod-456']
      );
      expect(storage.toPublicUrl).toHaveBeenCalledWith('snap.jpg');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        snap: { ...mockSnap, media_url: 'http://mocked-public-url/snap.jpg' },
      });
    });

    test('test_createSnap_missingMediaUrl_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { caption: 'No media' } });
      const res = mockRes();

      // Act
      await snapController.createSnap(req, res);

      // Assert
      expect(mockDb.query).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Media URL is required' });
    });

    test('test_createSnap_databaseInsertFails_returns500ServerError', async () => {
      // Arrange
      mockDb.query.mockRejectedValueOnce(new Error('DB Insert Error'));

      const req = mockReq({ body: { media_url: 'snap.jpg' } });
      const res = mockRes();

      // Act
      await snapController.createSnap(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server Error' });
    });
  });

  // ── getSnapFeed ─────────────────────────────────────────────────────
  describe('getSnapFeed', () => {
    test('test_getSnapFeed_validQuery_returns200AndFeedWithPublicUrls', async () => {
      // Arrange
      const mockRows = [
        {
          store_id: 'store-1',
          store_name: 'Store 1',
          store_logo: 'logo1.jpg',
          snaps: [
            { id: 10, media_url: 'snap10.jpg', caption: 'Snap 10' },
            { id: 11, media_url: 'snap11.jpg', caption: 'Snap 11' },
          ],
        },
      ];
      mockDb.query.mockResolvedValueOnce({ rows: mockRows });

      const req = mockReq();
      const res = mockRes();

      // Act
      await snapController.getSnapFeed(req, res);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        feed: [
          {
            store_id: 'store-1',
            store_name: 'Store 1',
            store_logo: 'http://mocked-public-url/logo1.jpg',
            snaps: [
              { id: 10, media_url: 'http://mocked-public-url/snap10.jpg', caption: 'Snap 10' },
              { id: 11, media_url: 'http://mocked-public-url/snap11.jpg', caption: 'Snap 11' },
            ],
          },
        ],
      });
    });

    test('test_getSnapFeed_databaseSelectFails_returns500ServerError', async () => {
      // Arrange
      mockDb.query.mockRejectedValueOnce(new Error('DB Select Error'));

      const req = mockReq();
      const res = mockRes();

      // Act
      await snapController.getSnapFeed(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server Error' });
    });
  });

  // ── viewSnap ────────────────────────────────────────────────────────
  describe('viewSnap', () => {
    test('test_viewSnap_validId_incrementsViewCountAndReturns200Success', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      const req = mockReq({ params: { id: 'snap-123' } });
      const res = mockRes();

      // Act
      await snapController.viewSnap(req, res);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE snaps SET view_count'),
        ['snap-123']
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    test('test_viewSnap_databaseUpdateFails_returns500ServerError', async () => {
      // Arrange
      mockDb.query.mockRejectedValueOnce(new Error('DB Update Error'));

      const req = mockReq({ params: { id: 'snap-123' } });
      const res = mockRes();

      // Act
      await snapController.viewSnap(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server Error' });
    });
  });

  // ── deleteSnap ──────────────────────────────────────────────────────
  describe('deleteSnap', () => {
    test('test_deleteSnap_authorizedOwner_deletesAndReturns200Success', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rowCount: 1 });

      const req = mockReq({ params: { id: 'snap-123' }, store: { id: 'store-123' } });
      const res = mockRes();

      // Act
      await snapController.deleteSnap(req, res);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM snaps'),
        ['snap-123', 'store-123']
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Snap deleted' });
    });

    test('test_deleteSnap_snapNotFoundOrUnauthorized_returns404NotFound', async () => {
      // Arrange
      mockDb.query.mockResolvedValueOnce({ rowCount: 0 });

      const req = mockReq({ params: { id: 'snap-123' }, store: { id: 'store-123' } });
      const res = mockRes();

      // Act
      await snapController.deleteSnap(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Snap not found or unauthorized' });
    });

    test('test_deleteSnap_databaseDeleteFails_returns500ServerError', async () => {
      // Arrange
      mockDb.query.mockRejectedValueOnce(new Error('DB Delete Error'));

      const req = mockReq({ params: { id: 'snap-123' }, store: { id: 'store-123' } });
      const res = mockRes();

      // Act
      await snapController.deleteSnap(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Server Error' });
    });
  });
});
