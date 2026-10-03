import { Redirect, Stack } from 'expo-router';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#121212' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
          contentStyle: { backgroundColor: '#121212' },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="list" options={{ headerShown: false }} />
      </Stack>
    </AppShell>
  );
}
