/**
 * __tests__/components/CountryPicker.test.tsx
 *
 * Unit tests for the CountryPicker component.
 * Ionicons is mocked so no native icon modules are required.
 * Conforms to guidelines/test.md.
 *
 * Note: @testing-library/react-native v14 render() is async.
 * screen queries are used to reflect the latest render tree.
 */

// ── Module mocks (must precede imports) ────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Ionicons: MockIcon };
});

// ── Imports ─────────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent, act, screen } from '@testing-library/react-native';
import CountryPicker from '../../components/CountryPicker';

// ── Default props factory ────────────────────────────────────────────────────

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof CountryPicker>> = {}
) {
  return {
    visible: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    selectedCountryCode: undefined,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CountryPicker Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  test('test_CountryPicker_visible_rendersModalWithTitle', async () => {
    await render(<CountryPicker {...defaultProps()} />);
    expect(screen.getByText('Select Country')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersSearchInput', async () => {
    await render(<CountryPicker {...defaultProps()} />);
    expect(screen.getByPlaceholderText('Search country or code...')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersAllCountriesInitially', async () => {
    await render(<CountryPicker {...defaultProps()} />);
    expect(screen.getByText('Ghana')).toBeTruthy();
    expect(screen.getByText('Nigeria')).toBeTruthy();
    expect(screen.getByText('United States')).toBeTruthy();
    expect(screen.getByText('United Kingdom')).toBeTruthy();
    expect(screen.getByText('Canada')).toBeTruthy();
    expect(screen.getByText('South Africa')).toBeTruthy();
    expect(screen.getByText('India')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersDialCodes', async () => {
    await render(<CountryPicker {...defaultProps()} />);
    expect(screen.getByText('+233')).toBeTruthy();
    expect(screen.getByText('+234')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersFlagEmojis', async () => {
    await render(<CountryPicker {...defaultProps()} />);
    expect(screen.getByText('🇬🇭')).toBeTruthy();
    expect(screen.getByText('🇳🇬')).toBeTruthy();
  });

  // ── Country selection ─────────────────────────────────────────────────────

  test('test_CountryPicker_selectCountry_callsOnSelectWithCountryObject', async () => {
    const onSelect = jest.fn();
    await render(<CountryPicker {...defaultProps({ onSelect })} />);

    await act(async () => { fireEvent.press(screen.getByText('Ghana')); });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ghana',
        code: 'GH',
        dial_code: '+233',
      })
    );
  });

  test('test_CountryPicker_selectCountry_callsOnClose', async () => {
    const onClose = jest.fn();
    await render(<CountryPicker {...defaultProps({ onClose })} />);

    await act(async () => { fireEvent.press(screen.getByText('Nigeria')); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('test_CountryPicker_selectCountry_callsOnSelectBeforeOnClose', async () => {
    const callOrder: string[] = [];
    const onSelect = jest.fn(() => callOrder.push('onSelect'));
    const onClose = jest.fn(() => callOrder.push('onClose'));

    await render(<CountryPicker {...defaultProps({ onSelect, onClose })} />);
    await act(async () => { fireEvent.press(screen.getByText('Canada')); });

    expect(callOrder).toEqual(['onSelect', 'onClose']);
  });

  // ── Selected state indicator ──────────────────────────────────────────────

  test('test_CountryPicker_withSelectedCountryCode_showsCheckmarkForSelectedCountry', async () => {
    await render(
      <CountryPicker {...defaultProps({ selectedCountryCode: 'GH' })} />
    );
    // Ionicons "checkmark-circle" mock renders the icon name as text
    const checkmarks = screen.getAllByText('checkmark-circle');
    expect(checkmarks).toHaveLength(1);
  });

  test('test_CountryPicker_withNoSelectedCountryCode_showsNoCheckmark', async () => {
    await render(<CountryPicker {...defaultProps()} />);
    expect(screen.queryByText('checkmark-circle')).toBeNull();
  });

  // ── Search / filtering ────────────────────────────────────────────────────

  test('test_CountryPicker_searchByName_filtersCountriesToMatchingResults', async () => {
    await render(<CountryPicker {...defaultProps()} />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search country or code...'),
        'Ghana'
      );
    });

    expect(screen.getByText('Ghana')).toBeTruthy();
    expect(screen.queryByText('Nigeria')).toBeNull();
    expect(screen.queryByText('United States')).toBeNull();
  });

  test('test_CountryPicker_searchByPartialName_returnsMatchingSubset', async () => {
    await render(<CountryPicker {...defaultProps()} />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search country or code...'),
        'United'
      );
    });

    expect(screen.getByText('United States')).toBeTruthy();
    expect(screen.getByText('United Kingdom')).toBeTruthy();
    expect(screen.queryByText('Ghana')).toBeNull();
  });

  test('test_CountryPicker_searchByDialCode_filtersToMatchingCountries', async () => {
    await render(<CountryPicker {...defaultProps()} />);

    // +233 is Ghana only
    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search country or code...'),
        '+233'
      );
    });

    expect(screen.getByText('Ghana')).toBeTruthy();
    expect(screen.queryByText('Nigeria')).toBeNull();
  });

  test('test_CountryPicker_searchIsCaseInsensitive_returnsResults', async () => {
    await render(<CountryPicker {...defaultProps()} />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search country or code...'),
        'ghana'
      );
    });

    expect(screen.getByText('Ghana')).toBeTruthy();
  });

  test('test_CountryPicker_searchNoMatch_rendersEmptyList', async () => {
    await render(<CountryPicker {...defaultProps()} />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search country or code...'),
        'Zzzzzzz'
      );
    });

    expect(screen.queryByText('Ghana')).toBeNull();
    expect(screen.queryByText('Nigeria')).toBeNull();
  });

  test('test_CountryPicker_selectCountryWhileSearching_resetsSearchOnClose', async () => {
    await render(<CountryPicker {...defaultProps()} />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search country or code...'),
        'Gha'
      );
    });

    await act(async () => { fireEvent.press(screen.getByText('Ghana')); });

    // After selection the internal search state should reset to ''
    expect(screen.getByPlaceholderText('Search country or code...').props.value).toBe('');
  });

  // ── Close button ──────────────────────────────────────────────────────────

  test('test_CountryPicker_closeButtonPress_callsOnClose', async () => {
    const onClose = jest.fn();
    await render(<CountryPicker {...defaultProps({ onClose })} />);

    // Ionicons "close" mock renders its name as text
    await act(async () => { fireEvent.press(screen.getByText('close')); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
