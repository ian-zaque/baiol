import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function FadeFill({
  colors,
}: {
  colors: readonly [string, string, string];
}) {
  const shift = useSharedValue(0);

  useEffect(() => {
    shift.value = withSequence(
      withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
    );
  }, [shift]);

  const wash = useAnimatedStyle(() => ({
    opacity: shift.value * 0.12,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[colors[0], colors[1], colors[2]]}
        locations={[0, 0.55, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, wash]} />
    </View>
  );
}
