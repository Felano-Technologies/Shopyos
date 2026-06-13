'use strict';

jest.mock('axios');
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const axios = require('axios');
const { createTransferRecipient, initiateTransfer, listBanks } = require('../../services/paystackService');

describe('paystackService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createTransferRecipient', () => {
    const recipientData = {
      name: 'Kwame Mensah',
      account_number: '1234567890',
      bank_code: '030100',
      currency: 'GHS',
    };

    test('returns recipient_code on success', async () => {
      axios.post.mockResolvedValueOnce({
        data: { status: true, data: { recipient_code: 'RCP_abc123' } },
      });

      const code = await createTransferRecipient(recipientData);
      expect(code).toBe('RCP_abc123');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/transferrecipient'),
        expect.objectContaining({ account_number: '1234567890', bank_code: '030100' }),
        expect.any(Object)
      );
    });

    test('defaults currency to GHS when not provided', async () => {
      axios.post.mockResolvedValueOnce({
        data: { status: true, data: { recipient_code: 'RCP_def456' } },
      });

      await createTransferRecipient({ ...recipientData, currency: undefined });
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ currency: 'GHS' }),
        expect.any(Object)
      );
    });

    test('throws when Paystack returns status false', async () => {
      axios.post.mockResolvedValueOnce({
        data: { status: false, message: 'Invalid account' },
      });

      await expect(createTransferRecipient(recipientData)).rejects.toThrow('Invalid account');
    });

    test('re-throws on network error', async () => {
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      await expect(createTransferRecipient(recipientData)).rejects.toThrow('Network error');
    });
  });

  describe('initiateTransfer', () => {
    const transferData = { amount: 100, recipient: 'RCP_abc123', reason: 'Test payout' };

    test('returns transfer data on success', async () => {
      const mockTransfer = { id: 'TRF_001', status: 'success', reference: 'ref_001' };
      axios.post.mockResolvedValueOnce({ data: { status: true, data: mockTransfer } });

      const result = await initiateTransfer(transferData);
      expect(result).toEqual(mockTransfer);
    });

    test('converts amount to pesewas (× 100)', async () => {
      axios.post.mockResolvedValueOnce({ data: { status: true, data: {} } });
      await initiateTransfer(transferData);
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ amount: 10000 }),
        expect.any(Object)
      );
    });

    test('defaults reason when not provided', async () => {
      axios.post.mockResolvedValueOnce({ data: { status: true, data: {} } });
      await initiateTransfer({ amount: 50, recipient: 'RCP_x' });
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ reason: 'Payout from Shopyos' }),
        expect.any(Object)
      );
    });

    test('throws when Paystack returns status false', async () => {
      axios.post.mockResolvedValueOnce({ data: { status: false, message: 'Insufficient funds' } });
      await expect(initiateTransfer(transferData)).rejects.toThrow('Insufficient funds');
    });
  });

  describe('listBanks', () => {
    test('returns bank list on success', async () => {
      const banks = [{ name: 'GCB Bank', code: '030100' }];
      axios.get.mockResolvedValueOnce({ data: { data: banks } });

      const result = await listBanks();
      expect(result).toEqual(banks);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('country=ghana'),
        expect.any(Object)
      );
    });

    test('accepts custom country parameter', async () => {
      axios.get.mockResolvedValueOnce({ data: { data: [] } });
      await listBanks('nigeria');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('country=nigeria'),
        expect.any(Object)
      );
    });

    test('re-throws on API error', async () => {
      axios.get.mockRejectedValueOnce(new Error('API down'));
      await expect(listBanks()).rejects.toThrow('API down');
    });
  });
});
