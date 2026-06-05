/**
 * __tests__/hooks/useCategories.test.ts
 *
 * Unit tests for the useCategories hook.
 * TanStack query functions are mocked.
 * Conforms to guidelines/test.md.
 */

// Mock TanStack React Query hooks
jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
}));

// Mock categories API and keys
jest.mock('@/lib/query/api', () => ({
  __esModule: true,
  categoriesApi: {
    getAll: jest.fn(),
  },
}));

import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/query/api';
import { useCategories } from '../../hooks/useCategories';
import { queryKeys } from '@/lib/query/keys';

describe('useCategories Hooks Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('test_useCategories_validCall_invokesUseQueryWithCorrectConfig', () => {
    // Arrange
    const mockCategories = [{ id: 'cat-1', name: 'Electronics' }];
    (useQuery as jest.Mock).mockReturnValue({ data: mockCategories, isLoading: false });

    // Act
    const result = useCategories();

    // Assert
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.categories.list(),
        queryFn: categoriesApi.getAll,
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
      })
    );
    expect(result.data).toEqual(mockCategories);
  });
});
