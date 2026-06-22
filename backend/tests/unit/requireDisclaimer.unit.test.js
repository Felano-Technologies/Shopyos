'use strict';

jest.mock('../../db/repositories', () => ({
  disclaimers: {
    getByType: jest.fn(),
    checkAcknowledgement: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const requireDisclaimer = require('../../middleware/requireDisclaimer');

describe('requireDisclaimer middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 'user-uuid' },
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('test_requireDisclaimer_userNotAuthenticated_returns401', async () => {
    // Arrange
    req.user = null;
    const middleware = requireDisclaimer('refund_policy');

    // Act
    await middleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Authentication required' });
  });

  test('test_requireDisclaimer_noActiveDisclaimer_callsNext', async () => {
    // Arrange
    repositories.disclaimers.getByType.mockResolvedValueOnce(null);
    const middleware = requireDisclaimer('refund_policy');

    // Act
    await middleware(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('test_requireDisclaimer_alreadyAcknowledged_callsNext', async () => {
    // Arrange
    const activeDisclaimer = { type: 'refund_policy', version: '1.0', title: 'Terms', content: 'Text' };
    repositories.disclaimers.getByType.mockResolvedValueOnce(activeDisclaimer);
    repositories.disclaimers.checkAcknowledgement.mockResolvedValueOnce({ id: 'ack-uuid' });
    const middleware = requireDisclaimer('refund_policy');

    // Act
    await middleware(req, res, next);

    // Assert
    expect(repositories.disclaimers.checkAcknowledgement).toHaveBeenCalledWith('user-uuid', 'refund_policy', '1.0', null);
    expect(next).toHaveBeenCalled();
  });

  test('test_requireDisclaimer_notAcknowledged_returns403WithDisclaimer', async () => {
    // Arrange
    const activeDisclaimer = { type: 'refund_policy', version: '1.0', title: 'Terms', content: 'Text' };
    repositories.disclaimers.getByType.mockResolvedValueOnce(activeDisclaimer);
    repositories.disclaimers.checkAcknowledgement.mockResolvedValueOnce(null);
    const middleware = requireDisclaimer('refund_policy');

    // Act
    await middleware(req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Disclaimer acknowledgement required',
      requiresAcknowledgement: true,
      disclaimer: {
        type: 'refund_policy',
        version: '1.0',
        title: 'Terms',
        content: 'Text',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
