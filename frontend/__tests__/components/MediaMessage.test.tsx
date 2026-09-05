/**
 * __tests__/components/MediaMessage.test.tsx
 *
 * Reproduces the "stuck loading spinner" bug: MediaMessage passes onLoadStart/
 * onLoadEnd/onError to AppImage expecting the underlying expo-image to call them.
 * If AppImage drops those props, the spinner never clears.
 */

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: any) => React.createElement(Text, null, props.name);
  return { Ionicons: MockIcon };
});

jest.mock('expo-video', () => ({
  VideoView: () => null,
  useVideoPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    muted: false,
    volume: 1,
  })),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => {
      (global as any).__capturedImageProps = props;
      return React.createElement(View, { testID: 'mock-expo-image' });
    },
  };
});

import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import MediaMessage from '../../components/chat/MediaMessage';

jest.setTimeout(30000);

// Walk the rendered JSON tree counting nodes of a given RN component type
// (mirrors the tree-walk pattern used in ReviewCard.test.tsx).
function countNodesOfType(node: any, type: string): number {
  if (!node || typeof node !== 'object') return 0;
  let count = node.type === type ? 1 : 0;
  for (const child of node.children ?? []) {
    count += countNodesOfType(child, type);
  }
  return count;
}

describe('MediaMessage image loading spinner', () => {
  beforeEach(() => {
    (global as any).__capturedImageProps = null;
  });

  test('test_MediaMessage_onLoadEndFires_clearsLoadingSpinner', async () => {
    await render(<MediaMessage url="https://example.com/photo.jpg" isMe={false} />);

    expect(countNodesOfType(screen.toJSON(), 'ActivityIndicator')).toBe(1);

    await act(async () => {
      (global as any).__capturedImageProps?.onLoadEnd?.();
    });

    expect(countNodesOfType(screen.toJSON(), 'ActivityIndicator')).toBe(0);
  });

  test('test_MediaMessage_onErrorFires_clearsLoadingSpinner', async () => {
    await render(<MediaMessage url="https://example.com/broken.jpg" isMe={false} />);

    expect(countNodesOfType(screen.toJSON(), 'ActivityIndicator')).toBe(1);

    await act(async () => {
      (global as any).__capturedImageProps?.onError?.({ error: 'failed' });
    });

    expect(countNodesOfType(screen.toJSON(), 'ActivityIndicator')).toBe(0);
  });
});
