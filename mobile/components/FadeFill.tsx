import { StyleSheet, View } from 'react-native';
import { midColor } from '@/constants/Colors';

export function FadeFill({
  colors,
}: {
  colors: readonly [string, string, string];
}) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: midColor(colors[0], colors[2]) }]}
    />
  );
}
