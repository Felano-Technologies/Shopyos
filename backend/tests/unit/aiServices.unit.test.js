'use strict';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Gemini SDK mock ───────────────────────────────────────────────────────────
const mockSendMessage = jest.fn();
const mockGenerateContent = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
const mockGetGenerativeModel = jest.fn(() => ({
  startChat: mockStartChat,
  generateContent: mockGenerateContent,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// core.js
// ─────────────────────────────────────────────────────────────────────────────
describe('ai/core — getGenAI', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      })),
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
  });

  test('returns null when GEMINI_API_KEY is not set', () => {
    delete process.env.GEMINI_API_KEY;
    const { getGenAI } = require('../../services/ai/core');
    expect(getGenAI()).toBeNull();
  });

  test('returns a GoogleGenerativeAI instance when GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'test-key-abc';
    const { getGenAI } = require('../../services/ai/core');
    const result = getGenAI();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('getGenerativeModel');
  });

  test('returns the same instance on repeated calls (singleton)', () => {
    process.env.GEMINI_API_KEY = 'test-key-abc';
    const { getGenAI } = require('../../services/ai/core');
    const a = getGenAI();
    const b = getGenAI();
    expect(a).toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// chatbot.js
// ─────────────────────────────────────────────────────────────────────────────
describe('ai/chatbot — generateBotReply', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      })),
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
  });

  test('returns offline message when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateBotReply } = require('../../services/ai/chatbot');
    const result = await generateBotReply('user-1', 'hello', []);
    expect(result.reply).toMatch(/offline/i);
    expect(result.isEscalation).toBe(false);
  });

  test('returns reply from AI model on success', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockSendMessage.mockResolvedValueOnce({
      response: { text: () => 'Your order is being processed.' },
    });
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });

    const { generateBotReply } = require('../../services/ai/chatbot');
    const result = await generateBotReply('user-1', 'Where is my order?', []);
    expect(result.reply).toBe('Your order is being processed.');
    expect(result.isEscalation).toBe(false);
  });

  test('strips [ESCALATE] tag and sets isEscalation flag', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockSendMessage.mockResolvedValueOnce({
      response: { text: () => 'I cannot resolve this. [ESCALATE]' },
    });
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });

    const { generateBotReply } = require('../../services/ai/chatbot');
    const result = await generateBotReply('user-1', 'This is urgent', []);
    expect(result.isEscalation).toBe(true);
    expect(result.reply).not.toContain('[ESCALATE]');
  });

  test('throws when all models fail', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockSendMessage.mockRejectedValue(new Error('Quota exceeded'));
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });

    const { generateBotReply } = require('../../services/ai/chatbot');
    await expect(generateBotReply('user-1', 'hello', [])).rejects.toThrow();
  });

  test('formats chat history mapping bot messages to model role', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockSendMessage.mockResolvedValueOnce({ response: { text: () => 'Sure!' } });
    mockGetGenerativeModel.mockReturnValue({ startChat: mockStartChat });

    const history = [
      { sender_id: 'user-abc', content: 'Hello' },
      { sender_id: '00000000-0000-0000-0000-000000000001', content: 'Hi there!' },
    ];

    const { generateBotReply } = require('../../services/ai/chatbot');
    await generateBotReply('user-abc', 'What can you help with?', history);

    const chatArgs = mockStartChat.mock.calls[0][0];
    expect(chatArgs.history[0].role).toBe('user');
    expect(chatArgs.history[1].role).toBe('model');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// marketing.js
// ─────────────────────────────────────────────────────────────────────────────
describe('ai/marketing — generateNotificationText', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      })),
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
  });

  test('returns static fallback when GEMINI_API_KEY is not set (holiday)', async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateNotificationText } = require('../../services/ai/marketing');
    const result = await generateNotificationText('holiday', { holidayName: 'Independence Day' });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('message');
  });

  test('returns static fallback when GEMINI_API_KEY is not set (engagement)', async () => {
    delete process.env.GEMINI_API_KEY;
    const { generateNotificationText } = require('../../services/ai/marketing');
    const result = await generateNotificationText('engagement', { timeOfDay: 'morning' });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('message');
  });

  test('parses and returns AI-generated JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '{"title":"Happy Day! 🎉","message":"Shop now!"}' },
    });
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });

    const { generateNotificationText } = require('../../services/ai/marketing');
    const result = await generateNotificationText('holiday', { holidayName: 'Republic Day' });
    expect(result).toEqual({ title: 'Happy Day! 🎉', message: 'Shop now!' });
  });

  test('falls back to static template when AI returns invalid JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not valid json at all' },
    });
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });

    const { generateNotificationText } = require('../../services/ai/marketing');
    const result = await generateNotificationText('engagement', { timeOfDay: 'evening' });
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('message');
  });
});

describe('ai/marketing — getEngagementVariants', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('@google/generative-ai', () => ({
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      })),
    }));
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
  });

  test('returns static variants when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const { getEngagementVariants } = require('../../services/ai/marketing');
    const result = await getEngagementVariants('named_greeting', { timeOfDay: 'morning' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(v => {
      expect(v).toHaveProperty('title');
      expect(v).toHaveProperty('message');
    });
  });

  test('parses and returns AI-generated variants array', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const variants = [
      { title: 'Good morning! ☀️', message: 'Shop now on Shopyos!' },
      { title: 'Rise and shine 🌅', message: 'Fresh deals await you.' },
    ];
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(variants) },
    });
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });

    const { getEngagementVariants } = require('../../services/ai/marketing');
    const result = await getEngagementVariants('generic_greeting', { timeOfDay: 'morning' });
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Good morning! ☀️');
  });

  test('falls back to static variants when all models fail', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockGenerateContent.mockRejectedValue(new Error('Quota'));
    mockGetGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent });

    const { getEngagementVariants } = require('../../services/ai/marketing');
    const result = await getEngagementVariants('generic_greeting', { timeOfDay: 'afternoon' });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
