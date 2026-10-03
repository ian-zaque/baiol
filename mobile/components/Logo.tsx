import { Image, ImageStyle, StyleProp } from 'react-native';

export function Logo({
  size = 72,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      accessibilityLabel="Baiol"
      style={[{ width: size, height: size }, style]}
    />
  );
}
