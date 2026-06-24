'use strict';

jest.mock('../../db/repositories', () => ({
  disclaimers: {
    getByType: jest.fn(),
    createAcknowledgement: jest.fn(),
    checkAcknowledgement: jest.fn(),
    updateDisclaimer: jest.fn(),
    getAcknowledgementsAudit: jest.fn(),
  },
}));

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn(),
  cacheDel: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const redis = require('../../config/redis');
const {
  getDisclaimer,
  acknowledgeDisclaimer,
  checkAcknowledgement,
  updateDisclaimer,
  getAcknowledgementsAudit,
} = require('../../controllers/disclaimerController');

describe('disclaimerController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {},
      body: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
      user: { id: 'user-uuid' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('getDisclaimer', () => {
    test('test_getDisclaimer_cacheHit_returnsCachedDisclaimer', async () => {
      // Arrange
      req.params.type = 'refund_policy';
      const cached = { type: 'refund_policy', title: 'Refund Policy', content: 'Refund terms' };
      redis.cacheGet.mockResolvedValueOnce(cached);

      // Act
      await getDisclaimer(req, res, next);

      // Assert
      expect(redis.cacheGet).toHaveBeenCalledWith('disclaimer:refund_policy');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, disclaimer: cached });
      expect(repositories.disclaimers.getByType).not.toHaveBeenCalled();
    });

    test('test_getDisclaimer_cacheMiss_fetchesFromDbAndCaches', async () => {
      // Arrange
      req.params.type = 'refund_policy';
      const dbRow = { type: 'refund_policy', title: 'Refund Policy', content: 'Refund terms' };
      redis.cacheGet.mockResolvedValueOnce(null);
      repositories.disclaimers.getByType.mockResolvedValueOnce(dbRow);

      // Act
      await getDisclaimer(req, res, next);

      // Assert
      expect(redis.cacheGet).toHaveBeenCalledWith('disclaimer:refund_policy');
      expect(repositories.disclaimers.getByType).toHaveBeenCalledWith('refund_policy');
      expect(redis.cacheSet).toHaveBeenCalledWith('disclaimer:refund_policy', dbRow, 300);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, disclaimer: dbRow });
    });

    test('test_getDisclaimer_notFound_returns404', async () => {
      // Arrange
      req.params.type = 'unknown';
      redis.cacheGet.mockResolvedValueOnce(null);
      repositories.disclaimers.getByType.mockResolvedValueOnce(null);

      // Act
      await getDisclaimer(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Disclaimer not found' });
    });
  });

  describe('acknowledgeDisclaimer', () => {
    test('test_acknowledgeDisclaimer_validInput_createsAcknowledgement', async () => {
      // Arrange
      req.body = {
        disclaimerType: 'refund_policy',
        version: '1.0',
        contextId: 'order-uuid',
        contextType: 'order',
      };
      req.headers['user-agent'] = 'Mozilla';
      const ackRow = { id: 'ack-uuid', ...req.body };
      repositories.disclaimers.createAcknowledgement.mockResolvedValueOnce(ackRow);

      // Act
      await acknowledgeDisclaimer(req, res, next);

      // Assert
      expect(repositories.disclaimers.createAcknowledgement).toHaveBeenCalledWith(
        'user-uuid', 'refund_policy', '1.0', 'order-uuid', 'order', '127.0.0.1', 'Mozilla'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, acknowledgement: ackRow });
    });

    test('test_acknowledgeDisclaimer_missingFields_returns400', async () => {
      // Arrange
      req.body = { disclaimerType: 'refund_policy' }; // missing version

      // Act
      await acknowledgeDisclaimer(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'disclaimerType and version are required' });
    });
  });

  describe('checkAcknowledgement', () => {
    test('test_checkAcknowledgement_acknowledged_returnsTrue', async () => {
      // Arrange
      req.query = { type: 'refund_policy', version: '1.0', contextId: 'order-uuid' };
      const ackRow = { id: 'ack-uuid' };
      repositories.disclaimers.checkAcknowledgement.mockResolvedValueOnce(ackRow);

      // Act
      await checkAcknowledgement(req, res, next);

      // Assert
      expect(repositories.disclaimers.checkAcknowledgement).toHaveBeenCalledWith(
        'user-uuid', 'refund_policy', '1.0', 'order-uuid'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, acknowledged: true, acknowledgement: ackRow });
    });

    test('test_checkAcknowledgement_notAcknowledged_returnsFalse', async () => {
      // Arrange
      req.query = { type: 'refund_policy' };
      repositories.disclaimers.checkAcknowledgement.mockResolvedValueOnce(null);

      // Act
      await checkAcknowledgement(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, acknowledged: false, acknowledgement: null });
    });
  });

  describe('updateDisclaimer', () => {
    test('test_updateDisclaimer_validInput_updatesAndClearsCache', async () => {
      // Arrange
      req.params.type = 'refund_policy';
      req.body = { title: 'New Refund', content: 'New text', version: '1.1' };
      const updatedRow = { type: 'refund_policy', ...req.body };
      repositories.disclaimers.updateDisclaimer.mockResolvedValueOnce(updatedRow);

      // Act
      await updateDisclaimer(req, res, next);

      // Assert
      expect(repositories.disclaimers.updateDisclaimer).toHaveBeenCalledWith(
        'refund_policy', 'New Refund', 'New text', '1.1', 'user-uuid'
      );
      expect(redis.cacheDel).toHaveBeenCalledWith('disclaimer:refund_policy');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, disclaimer: updatedRow });
    });
  });
});
