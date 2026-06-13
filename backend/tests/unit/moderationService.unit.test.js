'use strict';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { containsProfanity, moderateText } = require('../../services/moderationService');

describe('moderationService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('containsProfanity', () => {
    test('returns false for clean text', () => {
      expect(containsProfanity('Hello, this is a great product!')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(containsProfanity('')).toBe(false);
    });

    test('returns false for null/undefined', () => {
      expect(containsProfanity(null)).toBe(false);
      expect(containsProfanity(undefined)).toBe(false);
    });

    test('returns false for non-string input', () => {
      expect(containsProfanity(123)).toBe(false);
    });

    test('detects direct profane word via word boundary (T1)', () => {
      expect(containsProfanity('What the fuck is this?')).toBe(true);
    });

    test('detects profanity in mixed case', () => {
      expect(containsProfanity('What the Fuck is this?')).toBe(true);
    });

    test('detects strict pattern without word boundary (T2)', () => {
      expect(containsProfanity('that is fck up')).toBe(true);
    });

    test('detects profanity with character substitutions (T3)', () => {
      expect(containsProfanity('sh1t')).toBe(true);
    });

    test('detects profanity with dot-separated letters (T3 normalized)', () => {
      expect(containsProfanity('f.u.c.k')).toBe(true);
    });

    test('detects profanity with spaces (T3 normalized)', () => {
      expect(containsProfanity('s h i t')).toBe(true);
    });

    test('does not flag "class" or "associate" as false positives', () => {
      expect(containsProfanity('I attend a class today')).toBe(false);
    });
  });

  describe('moderateText', () => {
    test('returns original text unchanged for clean content', () => {
      const result = moderateText('Great product, love it!');
      expect(result).toEqual({ isModerated: false, content: 'Great product, love it!' });
    });

    test('replaces profane content with moderation message', () => {
      const result = moderateText('This is bullshit');
      expect(result.isModerated).toBe(true);
      expect(result.content).toMatch(/flagged/i);
    });

    test('handles null/empty input', () => {
      expect(moderateText(null)).toEqual({ isModerated: false, content: '' });
      expect(moderateText('')).toEqual({ isModerated: false, content: '' });
    });

    test('does not modify original text reference', () => {
      const input = 'Good morning!';
      const result = moderateText(input);
      expect(result.content).toBe(input);
    });
  });
});
