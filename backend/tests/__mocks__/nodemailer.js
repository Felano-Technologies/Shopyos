/**
 * tests/__mocks__/nodemailer.js
 * Jest manual mock for nodemailer.
 * Prevents real SMTP connections during unit / integration tests.
 */
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
const mockTransporter = { sendMail: mockSendMail };

const nodemailer = {
  createTransport: jest.fn().mockReturnValue(mockTransporter),
  __mockTransporter: mockTransporter,
  __mockSendMail: mockSendMail,
};

module.exports = nodemailer;
