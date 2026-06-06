/**
 * __tests__/components/InAppToastHost.test.tsx
 *
 * Unit tests for InAppToastHost and CustomInAppToast.
 * All external dependencies (expo-router, expo-av, Animated) are mocked.
 * Conforms to guidelines/test.md.
 *
 * Note: @testing-library/react-native v14 render() is async.
 * screen queries are used to reflect the latest render tree.
 */

// ── Module mocks (must precede imports) ────────────────────────────────────

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useRootNavigationState: jest.fn(() => ({ key: 'root' })),
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setOnPlaybackStatusUpdate: jest.fn(),
          unloadAsync: jest.fn().mockResolvedValue(null),
        },
      }),
    },
  },
}));

// Minimal Animated mock — parallel.start() immediately invokes its callback
// so the animation "completes" synchronously during tests.
jest.mock('react-native/Libraries/Animated/Animated', () => {
  const ActualAnimated = jest.requireActual('react-native/Libraries/Animated/Animated');
  return {
    ...ActualAnimated,
    timing: jest.fn(() => ({ start: jest.fn() })),
    spring: jest.fn(() => ({ start: jest.fn() })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb?: () => void) => cb?.()),
    })),
  };
});

// ── Imports ─────────────────────────────────────────────────────────────────

import React from 'react';
import { render, act, fireEvent, screen } from '@testing-library/react-native';
import { InAppToastHost, CustomInAppToast } from '../../components/InAppToastHost';
import { useRootNavigationState, router } from 'expo-router';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders InAppToastHost, queues a toast via CustomInAppToast.show, then
 * flushes state updates so the toast becomes visible.
 *
 * IMPORTANT: `type` is NOT included in the base defaults — callers that want
 * no type (so the NOTIFICATION kicker is rendered) simply omit it from
 * `overrides`.  Callers that want a specific type pass it explicitly.
 */
async function renderWithToast(overrides: Record<string, unknown> = {}) {
  await render(<InAppToastHost />);

  await act(async () => {
    CustomInAppToast.show({
      title: 'Test Title',
      message: 'Test message',
      ...overrides,
    } as any);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InAppToastHost Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRootNavigationState as jest.Mock).mockReturnValue({ key: 'root' });
  });

  // ── Idle state ────────────────────────────────────────────────────────────

  test('test_InAppToastHost_noToastQueued_rendersNothing', async () => {
    const { toJSON } = await render(<InAppToastHost />);
    expect(toJSON()).toBeNull();
  });

  // ── show() ────────────────────────────────────────────────────────────────

  test('test_CustomInAppToast_show_displaysToastWithTitleAndMessage', async () => {
    await renderWithToast({
      title: 'Order Placed',
      message: 'Your order is confirmed.',
    });

    expect(screen.getByText('Order Placed')).toBeTruthy();
    expect(screen.getByText('Your order is confirmed.')).toBeTruthy();
  });

  // ── Toast types ───────────────────────────────────────────────────────────

  test('test_InAppToastHost_typeSuccess_rendersSuccessKicker', async () => {
    await renderWithToast({ type: 'success', title: 'Done', message: 'OK' });
    expect(screen.getByText('SUCCESS')).toBeTruthy();
  });

  test('test_InAppToastHost_typeError_rendersErrorKicker', async () => {
    await renderWithToast({ type: 'error', title: 'Oops', message: 'Failed' });
    expect(screen.getByText('ERROR')).toBeTruthy();
  });

  test('test_InAppToastHost_typeInfo_rendersInfoKicker', async () => {
    await renderWithToast({ type: 'info', title: 'Note', message: 'FYI' });
    expect(screen.getByText('INFO')).toBeTruthy();
  });

  test('test_InAppToastHost_noType_rendersNotificationKicker', async () => {
    await renderWithToast({ title: 'Hey', message: 'Listen' });
    // When type is omitted the kicker defaults to NOTIFICATION
    expect(screen.getByText('NOTIFICATION')).toBeTruthy();
  });

  // ── Press / navigate ──────────────────────────────────────────────────────

  test('test_InAppToastHost_pressWithOrderId_navigatesToOrderRoute', async () => {
    await renderWithToast({
      title: 'New Order',
      message: 'Order #42',
      data: { orderId: 42 },
    });

    await act(async () => {
      fireEvent.press(screen.getByText('New Order'));
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/order/[id]',
      params: { id: '42' },
    });
  });

  test('test_InAppToastHost_pressWithoutOrderId_navigatesToNotificationsRoute', async () => {
    await renderWithToast({ title: 'Hi', message: 'No order' });

    await act(async () => {
      fireEvent.press(screen.getByText('Hi'));
    });

    expect(router.push).toHaveBeenCalledWith('/notification');
  });

  test('test_InAppToastHost_pressWithCustomOnPress_callsOnPressCallback', async () => {
    const onPress = jest.fn();
    await renderWithToast({
      title: 'Custom',
      message: 'Tap me',
      onPress,
    });

    await act(async () => {
      fireEvent.press(screen.getByText('Custom'));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    // Custom onPress takes priority — router.push must NOT be called
    expect(router.push).not.toHaveBeenCalled();
  });

  // ── Navigation guard ──────────────────────────────────────────────────────

  test('test_InAppToastHost_navigationNotReady_doesNotNavigate', async () => {
    (useRootNavigationState as jest.Mock).mockReturnValue(null);

    await renderWithToast({ title: 'Early', message: 'Nav not ready' });

    await act(async () => {
      fireEvent.press(screen.getByText('Early'));
    });

    expect(router.push).not.toHaveBeenCalled();
  });

  // ── Queue behaviour ───────────────────────────────────────────────────────

  test('test_CustomInAppToast_show_multipleToastsQueued_displaysFirstToastFirst', async () => {
    await render(<InAppToastHost />);

    // Queue the first toast in its own act() so it is set as currentToast
    // before the second is enqueued.  The second stays in the queue.
    await act(async () => {
      CustomInAppToast.show({ type: 'success', title: 'First Toast', message: 'First' });
    });

    // Queue the second toast without flushing the first away
    CustomInAppToast.show({ type: 'info', title: 'Second Toast', message: 'Second' });

    // Only the first queued toast should be visible at this point
    expect(screen.getByText('First Toast')).toBeTruthy();
  });
});
