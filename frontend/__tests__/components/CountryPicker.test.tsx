/**
 * __tests__/components/CountryPicker.test.tsx
 *
 * Unit tests for the CountryPicker component.
 * Ionicons is mocked so no native icon modules are required.
 * Conforms to guidelines/test.md.
 *
 * Note: @testing-library/react-native v14 render() is async.
 */

// ── Module mocks (must precede imports) ────────────────────────────────────

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => <Text>{name}</Text>;
  return { Ionicons: MockIcon };
});

// ── Imports ─────────────────────────────────────────────────────────────────

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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
    const { getByText } = await render(<CountryPicker {...defaultProps()} />);
    expect(getByText('Select Country')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersSearchInput', async () => {
    const { getByPlaceholderText } = await render(<CountryPicker {...defaultProps()} />);
    expect(getByPlaceholderText('Search country or code...')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersAllCountriesInitially', async () => {
    const { getByText } = await render(<CountryPicker {...defaultProps()} />);
    expect(getByText('Ghana')).toBeTruthy();
    expect(getByText('Nigeria')).toBeTruthy();
    expect(getByText('United States')).toBeTruthy();
    expect(getByText('United Kingdom')).toBeTruthy();
    expect(getByText('Canada')).toBeTruthy();
    expect(getByText('South Africa')).toBeTruthy();
    expect(getByText('India')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersDialCodes', async () => {
    const { getByText } = await render(<CountryPicker {...defaultProps()} />);
    expect(getByText('+233')).toBeTruthy();
    expect(getByText('+234')).toBeTruthy();
  });

  test('test_CountryPicker_visible_rendersFlagEmojis', async () => {
    const { getByText } = await render(<CountryPicker {...defaultProps()} />);
    expect(getByText('🇬🇭')).toBeTruthy();
    expect(getByText('🇳🇬')).toBeTruthy();
  });

  // ── Country selection ─────────────────────────────────────────────────────

  test('test_CountryPicker_selectCountry_callsOnSelectWithCountryObject', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(<CountryPicker {...defaultProps({ onSelect })} />);

    fireEvent.press(getByText('Ghana'));

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
    const { getByText } = await render(<CountryPicker {...defaultProps({ onClose })} />);

    fireEvent.press(getByText('Nigeria'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('test_CountryPicker_selectCountry_callsOnSelectBeforeOnClose', async () => {
    const callOrder: string[] = [];
    const onSelect = jest.fn(() => callOrder.push('onSelect'));
    const onClose = jest.fn(() => callOrder.push('onClose'));

    const { getByText } = await render(<CountryPicker {...defaultProps({ onSelect, onClose })} />);
    fireEvent.press(getByText('Canada'));

    expect(callOrder).toEqual(['onSelect', 'onClose']);
  });

  // ── Selected state indicator ──────────────────────────────────────────────

  test('test_CountryPicker_withSelectedCountryCode_showsCheckmarkForSelectedCountry', async () => {
    const { getAllByText } = await render(
      <CountryPicker {...defaultProps({ selectedCountryCode: 'GH' })} />
    );
    // Ionicons "checkmark-circle" mock renders the icon name as text
    const checkmarks = getAllByText('checkmark-circle');
    expect(checkmarks).toHaveLength(1);
  });

  test('test_CountryPicker_withNoSelectedCountryCode_showsNoCheckmark', async () => {
    const { queryByText } = await render(<CountryPicker {...defaultProps()} />);
    expect(queryByText('checkmark-circle')).toBeNull();
  });

  // ── Search / filtering ────────────────────────────────────────────────────

  test('test_CountryPicker_searchByName_filtersCountriesToMatchingResults', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(
      <CountryPicker {...defaultProps()} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Search country or code...'),
      'Ghana'
    );

    expect(getByText('Ghana')).toBeTruthy();
    expect(queryByText('Nigeria')).toBeNull();
    expect(queryByText('United States')).toBeNull();
  });

  test('test_CountryPicker_searchByPartialName_returnsMatchingSubset', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(
      <CountryPicker {...defaultProps()} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Search country or code...'),
      'United'
    );

    expect(getByText('United States')).toBeTruthy();
    expect(getByText('United Kingdom')).toBeTruthy();
    expect(queryByText('Ghana')).toBeNull();
  });

  test('test_CountryPicker_searchByDialCode_filtersToMatchingCountries', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await render(
      <CountryPicker {...defaultProps()} />
    );

    // +233 is Ghana only
    fireEvent.changeText(
      getByPlaceholderText('Search country or code...'),
      '+233'
    );

    expect(getByText('Ghana')).toBeTruthy();
    expect(queryByText('Nigeria')).toBeNull();
  });

  test('test_CountryPicker_searchIsCaseInsensitive_returnsResults', async () => {
    const { getByPlaceholderText, getByText } = await render(
      <CountryPicker {...defaultProps()} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Search country or code...'),
      'ghana'
    );

    expect(getByText('Ghana')).toBeTruthy();
  });

  test('test_CountryPicker_searchNoMatch_rendersEmptyList', async () => {
    const { getByPlaceholderText, queryByText } = await render(
      <CountryPicker {...defaultProps()} />
    );

    fireEvent.changeText(
      getByPlaceholderText('Search country or code...'),
      'Zzzzzzz'
    );

    expect(queryByText('Ghana')).toBeNull();
    expect(queryByText('Nigeria')).toBeNull();
  });

  test('test_CountryPicker_selectCountryWhileSearching_resetsSearchOnClose', async () => {
    const { getByPlaceholderText, getByText } = await render(
      <CountryPicker {...defaultProps()} />
    );
    const input = getByPlaceholderText('Search country or code...');

    fireEvent.changeText(input, 'Gha');
    fireEvent.press(getByText('Ghana'));

    // After selection the internal search state should reset to ''
    expect(input.props.value).toBe('');
  });

  // ── Close button ──────────────────────────────────────────────────────────

  test('test_CountryPicker_closeButtonPress_callsOnClose', async () => {
    const onClose = jest.fn();
    const { getByText } = await render(<CountryPicker {...defaultProps({ onClose })} />);

    // Ionicons "close" mock renders its name as text
    fireEvent.press(getByText('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
