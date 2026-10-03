import { Stack } from 'expo-router';

export default function ListIdLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#121212' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
        contentStyle: { backgroundColor: '#121212' },
      }}>
      <Stack.Screen name="index" options={{ title: 'List' }} />
      <Stack.Screen name="edit" options={{ title: 'Edit list', headerTitle: '' }} />
      <Stack.Screen name="share" options={{ title: 'Share list', headerTitle: '' }} />
    </Stack>
  );
}
