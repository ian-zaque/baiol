import { SymbolView } from 'expo-symbols';
import { ColorValue, Pressable } from 'react-native';

const ICONS = {
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  delete: { ios: 'trash', android: 'delete', web: 'delete' },
  exit: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  lists: { ios: 'list.bullet', android: 'list', web: 'list' },
  library: { ios: 'books.vertical', android: 'library_books', web: 'library_books' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  account: { ios: 'person.circle', android: 'person', web: 'person' },
  collapse: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  expand: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  color,
  size = 22,
}: {
  name: IconName;
  color?: ColorValue;
  size?: number;
}) {
  return <SymbolView name={ICONS[name]} tintColor={color} size={size} />;
}

export function IconButton({
  name,
  color,
  onPress,
  label,
  size = 22,
}: {
  name: IconName;
  color?: ColorValue;
  onPress: () => void;
  label: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
      })}>
      <Icon name={name} color={color} size={size} />
    </Pressable>
  );
}
