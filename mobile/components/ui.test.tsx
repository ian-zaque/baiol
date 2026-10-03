import { create, act } from 'react-test-renderer';
import { Pressable, TextInput, View } from 'react-native';
import { FadeFill } from '../components/FadeFill';
import { TextField } from '../components/ui';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/Icon', () => ({
  Icon: () => null,
  IconButton: () => null,
}));

jest.mock('@/components/layout', () => ({
  useLayout: () => ({ wide: false }),
}));

function render(element: React.ReactElement) {
  let tree: ReturnType<typeof create>;
  act(() => {
    tree = create(element);
  });
  return tree!;
}

describe('FadeFill', () => {
  it('paints the midpoint of the lightest and darkest color', () => {
    const tree = render(<FadeFill colors={['#FFFFFF', '#111111', '#000000']} />);
    const view = tree.root.findByType(View);
    const styles = view.props.style as { backgroundColor?: string }[];
    expect(styles.some((style) => style.backgroundColor === '#808080')).toBe(true);
  });
});

describe('password field', () => {
  it('starts hidden and reveals the password when the button is pressed', () => {
    const tree = render(
      <TextField label="Password" value="secret" onChangeText={() => undefined} secureTextEntry />,
    );

    expect(tree.root.findByType(TextInput).props.secureTextEntry).toBe(true);
    const show = tree.root.findByType(Pressable);

    act(() => {
      show.props.onPress();
    });

    expect(tree.root.findByType(TextInput).props.secureTextEntry).toBe(false);
    expect(tree.root.findByProps({ accessibilityLabel: 'Hide password' })).toBeTruthy();
  });

  it('does not add a visibility button to a normal field', () => {
    const tree = render(
      <TextField label="Email" value="ada@example.com" onChangeText={() => undefined} />,
    );
    expect(tree.root.findAllByType(Pressable)).toHaveLength(0);
    expect(tree.root.findByType(TextInput).props.secureTextEntry).toBe(false);
  });
});
