import * as React from 'react';
import renderer from 'react-test-renderer';
import { ThemedText } from '../ThemedText';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

it(`renders correctly`, () => {
  let tree: renderer.ReactTestRendererJSON | renderer.ReactTestRendererJSON[] | null = null;

  renderer.act(() => {
    tree = renderer.create(<ThemedText>Snapshot test!</ThemedText>).toJSON();
  });

  expect(tree).toMatchSnapshot();
});
