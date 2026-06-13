'use strict';

jest.mock('axios');
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const SAMPLE_HOLIDAYS = [
  { date: '2026-01-01', localName: "New Year's Day", name: "New Year's Day" },
  { date: '2026-03-06', localName: 'Independence Day', name: 'Independence Day' },
  { date: '2026-12-25', localName: 'Christmas Day', name: 'Christmas Day' },
];

// Use isolateModules per test so the module-level _cache resets each time.
function loadFresh() {
  let service;
  let axios;
  jest.isolateModules(() => {
    jest.mock('axios');
    jest.mock('../../config/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));
    axios = require('axios');
    service = require('../../services/holidayService');
  });
  return { service, axios };
}

describe('holidayService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('checkIfHoliday', () => {
    test('returns holiday info when date matches', async () => {
      const { service, axios } = loadFresh();
      axios.get.mockResolvedValueOnce({ data: SAMPLE_HOLIDAYS });

      const result = await service.checkIfHoliday(new Date('2026-01-01'));
      expect(result).toEqual({ localName: "New Year's Day", name: "New Year's Day" });
    });

    test('returns null when date is not a holiday', async () => {
      const { service, axios } = loadFresh();
      axios.get.mockResolvedValueOnce({ data: SAMPLE_HOLIDAYS });

      const result = await service.checkIfHoliday(new Date('2026-02-10'));
      expect(result).toBeNull();
    });

    test('returns null when API fails', async () => {
      const { service, axios } = loadFresh();
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.checkIfHoliday(new Date('2026-01-01'));
      expect(result).toBeNull();
    });

    test('caches holidays for the same year (only one API call)', async () => {
      const { service, axios } = loadFresh();
      axios.get.mockResolvedValue({ data: SAMPLE_HOLIDAYS });

      await service.checkIfHoliday(new Date('2026-01-01'));
      await service.checkIfHoliday(new Date('2026-03-06'));
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUpcomingHolidays', () => {
    test('returns holidays on or after today', async () => {
      const { service, axios } = loadFresh();
      axios.get.mockResolvedValueOnce({ data: SAMPLE_HOLIDAYS });

      const result = await service.getUpcomingHolidays();
      expect(Array.isArray(result)).toBe(true);
      result.forEach(h => {
        expect(h).toHaveProperty('date');
        expect(h).toHaveProperty('name');
      });
    });

    test('returns empty array when API fails', async () => {
      const { service, axios } = loadFresh();
      axios.get.mockRejectedValueOnce(new Error('Timeout'));

      const result = await service.getUpcomingHolidays();
      expect(result).toEqual([]);
    });
  });
});
