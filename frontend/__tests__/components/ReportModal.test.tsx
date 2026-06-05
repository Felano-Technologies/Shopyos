/**
 * __tests__/components/ReportModal.test.tsx
 *
 * Unit tests for the ReportModal component.
 * External services and toast are mocked so no real network calls occur.
 * Conforms to guidelines/test.md.
 *
 * Note: @testing-library/react-native v14 render() is async AND
 * fireEvent.press / fireEvent.changeText are async — always await them.
 * screen is used rather than destructured queries so the latest tree is queried.
 */

// ── Module mocks (must precede imports) ────────────────────────────────────

const mockReportEntity = jest.fn();

jest.mock('@/services/api', () => ({
  reportEntity: (...args: unknown[]) => mockReportEntity(...args),
}));

jest.mock('../../components/InAppToastHost', () => ({
  CustomInAppToast: { show: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Ionicons: MockIcon };
});

// ── Imports ─────────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { ReportModal } from '../../components/ReportModal';
import { CustomInAppToast } from '../../components/InAppToastHost';

// ── Default props factory ────────────────────────────────────────────────────

function defaultProps(overrides: Partial<React.ComponentProps<typeof ReportModal>> = {}) {
  return {
    visible: true,
    onClose: jest.fn(),
    entityType: 'user' as const,
    entityId: 'user-123',
    entityName: 'John Doe',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReportModal Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReportEntity.mockResolvedValue({ success: true });
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  test('test_ReportModal_visibleTrue_rendersModal', async () => {
    await render(<ReportModal {...defaultProps()} />);
    expect(screen.getByText('Report User')).toBeTruthy();
  });

  test('test_ReportModal_entityTypeStore_rendersTitleAsReportStore', async () => {
    await render(
      <ReportModal {...defaultProps({ entityType: 'store', entityName: 'My Shop' })} />
    );
    expect(screen.getByText('Report Store')).toBeTruthy();
  });

  test('test_ReportModal_visible_displaysEntityName', async () => {
    await render(<ReportModal {...defaultProps({ entityName: 'Alice' })} />);
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  test('test_ReportModal_visible_displaysAllReportReasons', async () => {
    await render(<ReportModal {...defaultProps()} />);
    expect(screen.getByText('Spam or misleading')).toBeTruthy();
    expect(screen.getByText('Inappropriate content')).toBeTruthy();
    expect(screen.getByText('Harassment or abuse')).toBeTruthy();
    expect(screen.getByText('Scam or fraud')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
  });

  // ── Close behaviour ───────────────────────────────────────────────────────

  test('test_ReportModal_closeButtonPress_callsOnClose', async () => {
    const onClose = jest.fn();
    await render(<ReportModal {...defaultProps({ onClose })} />);

    // The Ionicons "close" mock renders "close" as text
    await fireEvent.press(screen.getByText('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Reason selection ──────────────────────────────────────────────────────

  test('test_ReportModal_selectReason_highlightsSelectedReason', async () => {
    await render(<ReportModal {...defaultProps()} />);

    await fireEvent.press(screen.getByText('Spam or misleading'));

    // After selection the check icon becomes visible (Ionicons mock renders 'checkmark-circle' as text)
    expect(screen.getByText('checkmark-circle')).toBeTruthy();
  });

  test('test_ReportModal_selectDifferentReason_updatesSelection', async () => {
    await render(<ReportModal {...defaultProps()} />);

    await fireEvent.press(screen.getByText('Spam or misleading'));
    await fireEvent.press(screen.getByText('Other'));

    // Only one checkmark should exist (for 'Other')
    expect(screen.queryAllByText('checkmark-circle')).toHaveLength(1);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  test('test_ReportModal_submitWithoutReason_showsErrorToast', async () => {
    await render(<ReportModal {...defaultProps()} />);

    // Press Submit with no reason selected — the button is disabled but handler fires
    await fireEvent.press(screen.getByText('Submit Report'));

    expect(CustomInAppToast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Error' })
    );
    expect(mockReportEntity).not.toHaveBeenCalled();
  });

  test('test_ReportModal_submitWithoutReason_doesNotCallOnClose', async () => {
    const onClose = jest.fn();
    await render(<ReportModal {...defaultProps({ onClose })} />);

    await fireEvent.press(screen.getByText('Submit Report'));

    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Successful submission ─────────────────────────────────────────────────

  test('test_ReportModal_validSubmission_callsReportEntityWithCorrectArgs', async () => {
    await render(
      <ReportModal {...defaultProps({ entityType: 'user', entityId: 'user-123' })} />
    );

    await fireEvent.press(screen.getByText('Spam or misleading'));
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(mockReportEntity).toHaveBeenCalledWith(
        'user',
        'user-123',
        'Spam or misleading',
        '' // empty details
      );
    });
  });

  test('test_ReportModal_validSubmissionWithDetails_includesDetailsInCall', async () => {
    await render(<ReportModal {...defaultProps()} />);

    await fireEvent.press(screen.getByText('Other'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('Additional details (optional)'),
      'This account is fake.'
    );
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(mockReportEntity).toHaveBeenCalledWith(
        'user',
        'user-123',
        'Other',
        'This account is fake.'
      );
    });
  });

  test('test_ReportModal_successfulSubmission_showsSuccessToast', async () => {
    await render(<ReportModal {...defaultProps()} />);

    await fireEvent.press(screen.getByText('Spam or misleading'));
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(CustomInAppToast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });

  test('test_ReportModal_successfulSubmission_callsOnClose', async () => {
    const onClose = jest.fn();
    await render(<ReportModal {...defaultProps({ onClose })} />);

    await fireEvent.press(screen.getByText('Scam or fraud'));
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  test('test_ReportModal_apiFailure_showsErrorToastWithServerMessage', async () => {
    mockReportEntity.mockRejectedValueOnce(new Error('Server unavailable'));

    await render(<ReportModal {...defaultProps()} />);
    await fireEvent.press(screen.getByText('Spam or misleading'));
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(CustomInAppToast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: 'Server unavailable' })
      );
    });
  });

  test('test_ReportModal_apiFailureNoMessage_showsGenericErrorMessage', async () => {
    mockReportEntity.mockRejectedValueOnce({});

    await render(<ReportModal {...defaultProps()} />);
    await fireEvent.press(screen.getByText('Inappropriate content'));
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(CustomInAppToast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: 'Something went wrong.' })
      );
    });
  });

  test('test_ReportModal_apiFailure_doesNotCallOnClose', async () => {
    mockReportEntity.mockRejectedValueOnce(new Error('Nope'));
    const onClose = jest.fn();

    await render(<ReportModal {...defaultProps({ onClose })} />);
    await fireEvent.press(screen.getByText('Other'));
    await fireEvent.press(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Details input ─────────────────────────────────────────────────────────

  test('test_ReportModal_additionalDetailsInput_acceptsText', async () => {
    await render(<ReportModal {...defaultProps()} />);

    await fireEvent.changeText(
      screen.getByPlaceholderText('Additional details (optional)'),
      'Some extra context'
    );

    // Re-query after state update to get the latest value
    expect(
      screen.getByPlaceholderText('Additional details (optional)').props.value
    ).toBe('Some extra context');
  });
});
