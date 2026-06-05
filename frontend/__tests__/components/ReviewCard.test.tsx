/**
 * __tests__/components/ReviewCard.test.tsx
 *
 * Unit tests for the ReviewCard component.
 * Icon libraries and date-fns are mocked so no native modules are required.
 * Conforms to guidelines/test.md.
 *
 * Note: @testing-library/react-native v14 render() and fireEvent.* are async.
 * screen is used rather than destructured queries.
 */

// ── Module mocks (must precede imports) ────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => (
    <Text testID={`icon-${name}`}>{name}</Text>
  );
  return { Ionicons: MockIcon, Feather: MockIcon };
});

jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 days'),
}));

// ── Imports ─────────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { ReviewCard } from '../../components/ReviewCard';

// ── Fixture factory ──────────────────────────────────────────────────────────

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    user: { full_name: 'Jane Doe', avatar_url: 'https://example.com/avatar.png' },
    rating: 4,
    review_text: 'Great product, highly recommended!',
    created_at: '2024-01-15T10:00:00Z',
    likes_count: 5,
    comments_count: 2,
    isLiked: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReviewCard Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('test_ReviewCard_withReviewData_rendersReviewerName', async () => {
    await render(<ReviewCard review={makeReview()} />);
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  test('test_ReviewCard_withReviewData_rendersRatingValue', async () => {
    await render(<ReviewCard review={makeReview({ rating: 4 })} />);
    expect(screen.getByText('4')).toBeTruthy();
  });

  test('test_ReviewCard_withReviewData_rendersReviewText', async () => {
    await render(<ReviewCard review={makeReview()} />);
    expect(screen.getByText('Great product, highly recommended!')).toBeTruthy();
  });

  test('test_ReviewCard_withReviewData_rendersRelativeDate', async () => {
    await render(<ReviewCard review={makeReview()} />);
    expect(screen.getByText('2 days ago')).toBeTruthy();
  });

  test('test_ReviewCard_withLikesCount_rendersLikeCount', async () => {
    // Use a unique likes_count to avoid ambiguity with other rendered numbers
    await render(<ReviewCard review={makeReview({ likes_count: 77, comments_count: 3 })} />);
    expect(screen.getByText('77')).toBeTruthy();
  });

  test('test_ReviewCard_withCommentsCount_rendersCommentCount', async () => {
    // Use a comments_count that differs from likes_count to target it uniquely
    await render(<ReviewCard review={makeReview({ likes_count: 5, comments_count: 13 })} />);
    expect(screen.getByText('13')).toBeTruthy();
  });

  test('test_ReviewCard_withNoCommentsCount_rendersZero', async () => {
    const review = { ...makeReview(), likes_count: 99 };
    delete (review as any).comments_count;
    await render(<ReviewCard review={review} />);
    // 0 comes from the fallback `review.comments_count || 0`
    expect(screen.getByText('0')).toBeTruthy();
  });

  test('test_ReviewCard_withNoAvatar_usesInitialsFallbackUrl', async () => {
    const review = makeReview({ user: { full_name: 'John Smith', avatar_url: null } });
    await render(<ReviewCard review={review} />);
    const { Image } = require('react-native');
    const img = screen.UNSAFE_getAllByType(Image)[0];
    expect(img.props.source.uri).toContain('dicebear');
  });

  // ── Like button ───────────────────────────────────────────────────────────

  test('test_ReviewCard_likeButtonPress_callsOnLikeWithReviewId', async () => {
    const onLike = jest.fn();
    // Use distinct counts to avoid ambiguity
    await render(<ReviewCard review={makeReview({ id: 'review-42', likes_count: 10, comments_count: 3 })} onLike={onLike} />);

    await fireEvent.press(screen.getByText('10'));

    expect(onLike).toHaveBeenCalledTimes(1);
    expect(onLike).toHaveBeenCalledWith('review-42');
  });

  test('test_ReviewCard_likeButtonPress_incrementsLocalLikeCount', async () => {
    await render(<ReviewCard review={makeReview({ likes_count: 20, comments_count: 1 })} />);

    await fireEvent.press(screen.getByText('20'));

    expect(screen.getByText('21')).toBeTruthy();
  });

  test('test_ReviewCard_likeButtonPressWhenAlreadyLiked_decrementsLocalLikeCount', async () => {
    await render(<ReviewCard review={makeReview({ likes_count: 20, isLiked: true, comments_count: 1 })} />);

    await fireEvent.press(screen.getByText('20'));

    expect(screen.getByText('19')).toBeTruthy();
  });

  test('test_ReviewCard_likeButtonPressToggle_togglesLikedState', async () => {
    await render(<ReviewCard review={makeReview({ likes_count: 30, isLiked: false, comments_count: 1 })} />);

    // Like
    await fireEvent.press(screen.getByText('30'));
    expect(screen.getByText('31')).toBeTruthy();

    // Unlike
    await fireEvent.press(screen.getByText('31'));
    expect(screen.getByText('30')).toBeTruthy();
  });

  test('test_ReviewCard_withoutOnLikeCallback_pressDoesNotThrow', async () => {
    await render(<ReviewCard review={makeReview({ likes_count: 40, comments_count: 1 })} />);
    await expect(fireEvent.press(screen.getByText('40'))).resolves.toBeUndefined();
  });

  // ── Comment button ────────────────────────────────────────────────────────

  test('test_ReviewCard_commentButtonPress_callsOnCommentWithReviewId', async () => {
    const onComment = jest.fn();
    // Use distinct counts: likes=50, comments=7 to avoid ambiguity
    await render(
      <ReviewCard
        review={makeReview({ id: 'review-99', likes_count: 50, comments_count: 7 })}
        onComment={onComment}
      />
    );

    await fireEvent.press(screen.getByText('7'));

    expect(onComment).toHaveBeenCalledTimes(1);
    expect(onComment).toHaveBeenCalledWith('review-99');
  });

  test('test_ReviewCard_withoutOnCommentCallback_commentPressDoesNotThrow', async () => {
    await render(<ReviewCard review={makeReview({ likes_count: 60, comments_count: 8 })} />);
    await expect(fireEvent.press(screen.getByText('8'))).resolves.toBeUndefined();
  });

  // ── Prop update ───────────────────────────────────────────────────────────

  test('test_ReviewCard_reviewPropChanges_updatesLikedState', async () => {
    const review = makeReview({ likes_count: 10, isLiked: false });
    const { rerender } = await render(<ReviewCard review={review} />);

    const updatedReview = makeReview({ likes_count: 11, isLiked: true });
    await rerender(<ReviewCard review={updatedReview} />);

    expect(screen.getByText('11')).toBeTruthy();
  });
});
