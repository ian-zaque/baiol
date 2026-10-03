import { Stack } from 'expo-router';

export default function ListStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
        contentStyle: { backgroundColor: '#121212' },
      }}>
      <Stack.Screen name="new" options={{ title: 'New list', headerTitle: '' }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
